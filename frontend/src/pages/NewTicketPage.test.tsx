import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import NewTicketPage from "./NewTicketPage";

describe("NewTicketPage", () => {
  it("permite revisar e editar a sugestao recebida de um artigo", async () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          initialEntries={[
            {
              pathname: "/chamados/novo",
              state: {
                title: "Configurar VPN corporativa",
                category: "NETWORK",
              },
            },
          ]}
        >
          <Routes>
            <Route path="/chamados/novo" element={<NewTicketPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText(/Revise e edite os campos/)).toBeInTheDocument();
    const title = screen.getByRole("textbox", { name: "Titulo" });
    await userEvent.clear(title);
    await userEvent.type(title, "VPN indisponivel no notebook");

    expect(title).toHaveValue("VPN indisponivel no notebook");
    expect(
      screen.getByRole("combobox", { name: "Categoria" }),
    ).toHaveTextContent("Rede");
  });
});
