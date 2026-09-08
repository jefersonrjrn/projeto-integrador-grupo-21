import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "./client";

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe("cliente HTTP", () => {
  it("envia token Bearer e retorna o JSON da API", async () => {
    sessionStorage.setItem("access_token", "demo-token");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: "1" })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await apiFetch("/api/v1/auth/me")).toEqual({ id: "1" });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8000/api/v1/auth/me");
    expect(options.headers.get("Authorization")).toBe("Bearer demo-token");
  });

  it("preserva status e mensagem de erro da API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "Sem permissao" }), {
          status: 403,
        }),
      ),
    );
    await expect(apiFetch("/api/v1/tickets")).rejects.toMatchObject({
      status: 403,
      message: "Sem permissao",
    });
  });

  it("trata erros sem corpo JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("offline", { status: 503 })),
    );
    await expect(apiFetch("/health")).rejects.toMatchObject({
      status: 503,
      message: "Erro inesperado. Tente novamente.",
    });
  });

  it("aceita resposta sem conteudo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );
    expect(await apiFetch("/api/v1/example")).toBeUndefined();
  });
});
