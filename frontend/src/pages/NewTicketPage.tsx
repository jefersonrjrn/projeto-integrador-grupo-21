import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from "@mui/material";

import { apiFetch, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { TicketCategory, TicketDetail } from "../types/domain";

const CATEGORIES: { value: TicketCategory; label: string }[] = [
  { value: "ACCESS", label: "Acesso" },
  { value: "SOFTWARE", label: "Software" },
  { value: "NETWORK", label: "Rede" },
  { value: "HARDWARE", label: "Hardware" },
  { value: "SECURITY", label: "Seguranca" },
  { value: "OTHER", label: "Outro" },
];

export default function NewTicketPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation() as {
    state?: { title?: string; category?: TicketCategory };
  };
  const [title, setTitle] = useState(location.state?.title ?? "");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TicketCategory>(
    location.state?.category ?? "OTHER",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasArticleSuggestion = Boolean(
    location.state?.title || location.state?.category,
  );

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch<TicketDetail>("/api/v1/tickets", {
        method: "POST",
        body: JSON.stringify({ title, description, category }),
      }),
    onSuccess: async (ticket) => {
      await queryClient.invalidateQueries({ queryKey: ["user", user?.id] });
      navigate(`/chamados/${ticket.id}`);
    },
    onError: (err) =>
      setErrorMessage(
        err instanceof ApiError ? err.message : "Erro ao abrir chamado.",
      ),
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (title.trim().length < 5 || title.trim().length > 160) {
      setErrorMessage("O titulo deve ter entre 5 e 160 caracteres.");
      return;
    }
    if (description.trim().length < 10 || description.trim().length > 2000) {
      setErrorMessage("A descricao deve ter entre 10 e 2000 caracteres.");
      return;
    }
    setErrorMessage(null);
    mutation.mutate();
  }

  return (
    <Paper
      sx={{ p: 3, maxWidth: 560 }}
      component="form"
      onSubmit={handleSubmit}
    >
      <Typography variant="h5" gutterBottom>
        Abrir novo chamado
      </Typography>
      {hasArticleSuggestion && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Preenchemos uma sugestao com base no artigo. Revise e edite os campos
          antes de enviar.
        </Alert>
      )}
      {errorMessage && (
        <Alert severity="error" sx={{ mb: 2 }} aria-live="polite">
          {errorMessage}
        </Alert>
      )}
      <TextField
        label="Titulo"
        fullWidth
        margin="normal"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        helperText="Entre 5 e 160 caracteres"
        inputProps={{ minLength: 5, maxLength: 160 }}
        required
      />
      <TextField
        select
        label="Categoria"
        fullWidth
        margin="normal"
        value={category}
        onChange={(event) => setCategory(event.target.value as TicketCategory)}
      >
        {CATEGORIES.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        label="Descricao"
        fullWidth
        margin="normal"
        multiline
        minRows={4}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        helperText="Entre 10 e 2000 caracteres"
        inputProps={{ minLength: 10, maxLength: 2000 }}
        required
      />
      <Button
        type="submit"
        variant="contained"
        sx={{ mt: 2 }}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? "Enviando..." : "Abrir chamado"}
      </Button>
    </Paper>
  );
}
