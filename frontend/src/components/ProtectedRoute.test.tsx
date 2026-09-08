import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProtectedRoute from "./ProtectedRoute";

const auth = vi.hoisted(() => ({
  user: null as null | { role: "EMPLOYEE" | "TECHNICIAN" },
}));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ user: auth.user }),
}));

function renderRoute(allowedRoles?: ("EMPLOYEE" | "TECHNICIAN")[]) {
  return render(
    <MemoryRouter initialEntries={["/restrita"]}>
      <Routes>
        <Route element={<ProtectedRoute allowedRoles={allowedRoles} />}>
          <Route path="/restrita" element={<div>Conteudo restrito</div>} />
        </Route>
        <Route path="/login" element={<div>Pagina de login</div>} />
        <Route path="/" element={<div>Pagina inicial</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    auth.user = null;
  });

  it("envia uma sessao ausente para o login", () => {
    renderRoute();
    expect(screen.getByText("Pagina de login")).toBeInTheDocument();
  });

  it("permite o perfil autorizado", () => {
    auth.user = { role: "EMPLOYEE" };
    renderRoute(["EMPLOYEE"]);
    expect(screen.getByText("Conteudo restrito")).toBeInTheDocument();
  });

  it("impede acesso de outro perfil", () => {
    auth.user = { role: "TECHNICIAN" };
    renderRoute(["EMPLOYEE"]);
    expect(screen.getByText("Pagina inicial")).toBeInTheDocument();
  });
});
