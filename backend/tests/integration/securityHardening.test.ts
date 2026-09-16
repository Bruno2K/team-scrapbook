import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../../src/app.js";
import { prisma } from "../../src/db/client.js";
import { canSendOrSignal } from "../../src/modules/messaging/index.js";
import { authenticateSocketToken } from "../../src/socket.js";
import { createComment } from "../../src/services/commentService.js";
import { createScrap } from "../../src/services/scrapService.js";

const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
const prefix = `security_${suffix}`;
const password = "password123";
const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

interface RegisteredUser {
  id: string;
  nickname: string;
  token: string;
}

async function register(label: string): Promise<RegisteredUser> {
  const nickname = `${prefix}_${label}`;
  const response = await request(app).post("/auth/register").send({
    name: `Security ${label}`,
    nickname,
    password,
  });
  expect(response.status).toBe(201);
  return { id: response.body.user.id, nickname, token: response.body.token };
}

describe("Issue #32 security regression coverage", () => {
  let alice: RegisteredUser;
  let bob: RegisteredUser;
  let outsider: RegisteredUser;
  let admin: RegisteredUser;
  let scrapId: string;
  let privateCommunityId: string;
  let privatePostId: string;
  let conversationId: string;

  beforeAll(async () => {
    alice = await register("alice");
    bob = await register("bob");
    outsider = await register("outsider");
    admin = await register("admin");
  });

  afterAll(async () => {
    await prisma.community.deleteMany({ where: { name: { startsWith: prefix } } });
    await prisma.user.deleteMany({ where: { nickname: { startsWith: prefix } } });
  });

  it("rejects malformed, invalid-signature, expired, invalid-claim, and deleted-user tokens", async () => {
    const secret = process.env.JWT_SECRET!;
    const tokens = [
      "not-a-jwt",
      jwt.sign({ userId: alice.id }, "wrong-secret", { expiresIn: "1h" }),
      jwt.sign({ userId: alice.id }, secret, { expiresIn: -1 }),
      jwt.sign({ purpose: "access" }, secret, { expiresIn: "1h" }),
    ];
    for (const token of tokens) {
      const response = await request(app).get("/users/me").set(authHeader(token));
      expect(response.status).toBe(401);
      expect(response.body.message).not.toContain(token);
    }

    const deleted = await register("deleted");
    await prisma.user.delete({ where: { id: deleted.id } });
    const response = await request(app).get("/users/me").set(authHeader(deleted.token));
    expect(response.status).toBe(401);
    expect(await authenticateSocketToken(deleted.token)).toBeNull();
  });

  it("rejects privileged mass assignment without changing identity state", async () => {
    const registerNickname = `${prefix}_mass_assignment`;
    const registration = await request(app).post("/auth/register").send({
      name: "Mass Assignment",
      nickname: registerNickname,
      password,
      isAiManaged: true,
      role: "ADMIN",
    });
    expect(registration.status).toBe(400);
    expect(await prisma.user.findUnique({ where: { nickname: registerNickname } })).toBeNull();

    const before = await prisma.user.findUniqueOrThrow({ where: { id: alice.id } });
    const update = await request(app)
      .patch("/users/me")
      .set(authHeader(alice.token))
      .send({ name: "Changed", isAiManaged: true, steamId64: "attacker" });
    expect(update.status).toBe(400);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: alice.id } });
    expect(after.name).toBe(before.name);
    expect(after.isAiManaged).toBe(false);
    expect(after.steamId64).toBeNull();
  });

  it("keeps scraps and scrap media participant-only across direct and profile reads", async () => {
    const created = await request(app)
      .post("/scraps")
      .set(authHeader(alice.token))
      .send({
        toUserId: bob.id,
        content: "private scrap",
        attachments: [{ url: "https://example.com/private.png", type: "image" }],
      });
    expect(created.status).toBe(201);
    scrapId = created.body.id;

    expect((await request(app).get(`/feed/${scrapId}`)).status).toBe(404);
    expect((await request(app).get(`/feed/${scrapId}`).set(authHeader(outsider.token))).status).toBe(404);
    expect((await request(app).get(`/feed/${scrapId}/comments`).set(authHeader(outsider.token))).status).toBe(404);

    const profileFeed = await request(app).get(`/users/${bob.id}/feed`).set(authHeader(outsider.token));
    expect(profileFeed.status).toBe(200);
    expect(profileFeed.body.some((item: { id: string }) => item.id === scrapId)).toBe(false);

    const media = await request(app).get(`/users/${bob.id}/media`).set(authHeader(outsider.token));
    expect(media.status).toBe(200);
    expect(media.body.items.some((item: { scrapId?: string }) => item.scrapId === scrapId)).toBe(false);

    expect((await request(app).get(`/feed/${scrapId}`).set(authHeader(bob.token))).status).toBe(200);
  });

  it("denies comment-reaction IDOR on a participant-only scrap without mutation", async () => {
    const comment = await prisma.postComment.create({
      data: { userId: bob.id, scrapId, content: "participant comment" },
    });
    const response = await request(app)
      .post(`/comments/${comment.id}/reactions`)
      .set(authHeader(outsider.token))
      .send({ reaction: "heal" });
    expect(response.status).toBe(403);
    expect(await prisma.commentReaction.count({ where: { commentId: comment.id } })).toBe(0);
  });

  it("enforces private-community membership on generic read and interaction paths", async () => {
    const community = await request(app)
      .post("/communities")
      .set(authHeader(alice.token))
      .send({ name: `${prefix}_private`, description: "private", isPrivate: true });
    expect(community.status).toBe(201);
    privateCommunityId = community.body.id;

    const post = await request(app)
      .post(`/communities/${privateCommunityId}/posts`)
      .set(authHeader(alice.token))
      .send({ content: "members only" });
    expect(post.status).toBe(201);
    privatePostId = post.body.id;

    expect((await request(app).get(`/feed/${privatePostId}`)).status).toBe(404);
    expect((await request(app).get(`/feed/${privatePostId}/comments`).set(authHeader(outsider.token))).status).toBe(404);

    const commentAttempt = await request(app)
      .post(`/feed/${privatePostId}/comments`)
      .set(authHeader(outsider.token))
      .send({ content: "should not exist" });
    expect(commentAttempt.status).toBe(403);
    expect(await prisma.postComment.count({ where: { feedItemId: privatePostId, userId: outsider.id } })).toBe(0);

    const reactionAttempt = await request(app)
      .post(`/feed/${privatePostId}/reactions`)
      .set(authHeader(outsider.token))
      .send({ reaction: "heal" });
    expect(reactionAttempt.status).toBe(403);
    expect(await prisma.feedItemReaction.count({ where: { feedItemId: privatePostId, userId: outsider.id } })).toBe(0);
  });

  it("enforces owner-only destructive/admin community authority", async () => {
    await prisma.communityMember.createMany({
      data: [
        { communityId: privateCommunityId, userId: admin.id, role: "ADMIN" },
        { communityId: privateCommunityId, userId: bob.id, role: "MEMBER" },
      ],
      skipDuplicates: true,
    });

    const promote = await request(app)
      .patch(`/communities/${privateCommunityId}/members/${bob.id}/role`)
      .set(authHeader(admin.token))
      .send({ role: "ADMIN" });
    expect(promote.status).toBe(403);
    expect((await prisma.communityMember.findUniqueOrThrow({
      where: { userId_communityId: { userId: bob.id, communityId: privateCommunityId } },
    })).role).toBe("MEMBER");

    const removeCommunity = await request(app)
      .delete(`/communities/${privateCommunityId}`)
      .set(authHeader(admin.token));
    expect(removeCommunity.status).toBe(403);
    expect(await prisma.community.findUnique({ where: { id: privateCommunityId } })).not.toBeNull();

    const adminQueue = await request(app)
      .get(`/communities/${privateCommunityId}/join-requests`)
      .set(authHeader(outsider.token));
    expect(adminQueue.status).toBe(403);
  });

  it("applies block policy to requests, scraps, HTTP messaging, Socket policy, and notifications", async () => {
    const [user1Id, user2Id] = alice.id < bob.id ? [alice.id, bob.id] : [bob.id, alice.id];
    await prisma.friendship.upsert({
      where: { user1Id_user2Id: { user1Id, user2Id } },
      create: { user1Id, user2Id },
      update: {},
    });
    const conversation = await prisma.conversation.create({ data: { user1Id, user2Id } });
    conversationId = conversation.id;

    const blocked = await request(app)
      .post(`/users/${alice.id}/block`)
      .set(authHeader(bob.token));
    expect(blocked.status).toBe(200);

    const beforeScraps = await prisma.scrapMessage.count();
    const beforeNotifications = await prisma.notification.count({ where: { userId: bob.id } });
    const scrapAttempt = await request(app)
      .post("/scraps")
      .set(authHeader(alice.token))
      .send({ toUserId: bob.id, content: "blocked" });
    expect(scrapAttempt.status).toBe(403);
    expect(await prisma.scrapMessage.count()).toBe(beforeScraps);
    expect(await prisma.notification.count({ where: { userId: bob.id } })).toBe(beforeNotifications);

    const beforeMessages = await prisma.chatMessage.count({ where: { conversationId } });
    const messageAttempt = await request(app)
      .post("/chat/messages")
      .set(authHeader(alice.token))
      .send({ conversationId, content: "blocked message" });
    expect(messageAttempt.status).toBe(403);
    expect(await prisma.chatMessage.count({ where: { conversationId } })).toBe(beforeMessages);
    expect(await canSendOrSignal(conversationId, alice.id)).toBe(false);

    const staleRequest = await prisma.friendshipRequest.create({
      data: { fromUserId: alice.id, toUserId: bob.id, status: "PENDING" },
    });
    const accept = await request(app)
      .post(`/users/me/friend-requests/${staleRequest.id}/accept`)
      .set(authHeader(bob.token));
    expect(accept.status).toBe(403);
    expect((await prisma.friendshipRequest.findUniqueOrThrow({ where: { id: staleRequest.id } })).status).toBe("PENDING");
  });

  it("gives AI-managed actors no policy bypass and disables user-triggered impersonation", async () => {
    const ai = await prisma.user.create({
      data: {
        name: "Internal AI",
        nickname: `${prefix}_ai`,
        passwordHash: "not-an-interactive-password",
        isAiManaged: true,
      },
    });
    await prisma.blockedUser.create({ data: { blockerId: bob.id, blockedId: ai.id } });

    expect(await createScrap({ fromUserId: ai.id, toUserId: bob.id, content: "blocked AI" })).toBeNull();
    expect(await createComment(ai.id, privatePostId, "private AI comment")).toBeNull();
    expect(await prisma.postComment.count({ where: { userId: ai.id } })).toBe(0);

    const before = await prisma.feedItem.count();
    const trigger = await request(app)
      .post("/ai-actions/generate")
      .set(authHeader(alice.token));
    expect(trigger.status).toBe(403);
    expect(await prisma.feedItem.count()).toBe(before);
  });

  it("rate-limits registration by source IP even when nicknames vary", async () => {
    let deniedNickname: string | null = null;
    for (let index = 0; index < 12; index += 1) {
      const nickname = `${prefix}_rate_${index}`;
      const response = await request(app).post("/auth/register").send({
        name: "Rate Limited",
        nickname,
        password,
      });
      if (response.status === 429) {
        deniedNickname = nickname;
        expect(response.headers["retry-after"]).toBeDefined();
        break;
      }
      expect(response.status).toBe(201);
    }
    expect(deniedNickname).not.toBeNull();
    expect(await prisma.user.findUnique({ where: { nickname: deniedNickname! } })).toBeNull();
  });
});
