import { useRef, useCallback, useState, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY as string | undefined;

interface GiphyGif {
  id: string;
  images: {
    fixed_height: { url: string };
    original: { url: string };
  };
}

async function searchGiphy(q: string, signal?: AbortSignal): Promise<string[]> {
  if (!GIPHY_API_KEY || !q.trim()) return [];
  const params = new URLSearchParams({
    api_key: GIPHY_API_KEY,
    q: q.trim(),
    limit: "20",
    rating: "g",
  });
  const res = await fetch(`https://api.giphy.com/v1/gifs/search?${params}`, { signal });
  if (!res.ok) return [];
  const json = await res.json();
  const data = (json.data ?? []) as GiphyGif[];
  return data.map((g) => g.images.fixed_height.url || g.images.original.url).filter(Boolean);
}

export function GifPicker({ onInsert }: { onInsert: (url: string) => void }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [pasteUrl, setPasteUrl] = useState("");
  const searchAbortRef = useRef<AbortController | null>(null);

  const runSearch = useCallback(() => {
    if (!search.trim()) {
      setResults([]);
      return;
    }
    searchAbortRef.current?.abort();
    searchAbortRef.current = new AbortController();
    setLoading(true);
    searchGiphy(search, searchAbortRef.current.signal)
      .then(setResults)
      .catch(() => setResults([]))
      .finally(() => {
        setLoading(false);
        searchAbortRef.current = null;
      });
  }, [search]);

  const pickerContent = GIPHY_API_KEY ? (
    <Fragment>
      <div className="p-2 border-b border-border flex gap-2 flex-shrink-0">
        <Input
          placeholder="Buscar GIFs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), runSearch())}
          className="text-sm"
        />
        <Button type="button" size="sm" onClick={runSearch} disabled={loading}>
          {loading ? "…" : "Buscar"}
        </Button>
      </div>
      <div className="overflow-y-auto p-2 flex-1 min-h-0">
        {results.length > 0 ? (
          <div className="grid grid-cols-2 gap-1">
            {results.map((src) => (
              <button
                key={src}
                type="button"
                className="aspect-video rounded overflow-hidden border border-border hover:ring-2 hover:ring-accent focus:outline-none"
                onClick={() => onInsert(src)}
              >
                <img src={src} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        ) : search.trim() && !loading ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Nenhum GIF encontrado. Tente outra busca.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">
            Digite algo e clique em Buscar para ver GIFs.
          </p>
        )}
      </div>
      <div className="p-2 border-t border-border flex-shrink-0">
        <p className="text-[10px] text-muted-foreground uppercase font-heading mb-1">Ou cole a URL</p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const url = pasteUrl.trim();
            if (url) {
              onInsert(url);
              setPasteUrl("");
            }
          }}
        >
          <Input
            type="url"
            placeholder="https://..."
            value={pasteUrl}
            onChange={(e) => setPasteUrl(e.target.value)}
            className="text-sm"
          />
          <Button type="submit" size="sm">Inserir</Button>
        </form>
      </div>
    </Fragment>
  ) : (
    <div className="p-3 space-y-3">
      <p className="text-[10px] text-muted-foreground uppercase font-heading">
        Cole a URL de uma imagem ou GIF
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const url = pasteUrl.trim();
          if (url) {
            onInsert(url);
            setPasteUrl("");
          }
        }}
      >
        <Input
          type="url"
          placeholder="https://..."
          value={pasteUrl}
          onChange={(e) => setPasteUrl(e.target.value)}
          className="text-sm"
        />
        <Button type="submit" size="sm">Inserir</Button>
      </form>
      <p className="text-[10px] text-muted-foreground">
        Para buscar GIFs como no Discord, adicione <code className="bg-muted px-1 rounded">VITE_GIPHY_API_KEY</code> no seu <code className="bg-muted px-1 rounded">.env</code> (chave em developers.giphy.com).
      </p>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {pickerContent}
    </div>
  );
}
