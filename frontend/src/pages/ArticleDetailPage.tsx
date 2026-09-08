import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Box, Button, Paper, Typography } from "@mui/material";

import { apiFetch, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { LoadingState, ErrorState } from "../components/AsyncState";
import type { ArticleDetail } from "../types/domain";

export default function ArticleDetailPage() {
  const { user } = useAuth();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["user", user?.id, "article", slug],
    queryFn: () => apiFetch<ArticleDetail>(`/api/v1/articles/${slug}`),
    enabled: Boolean(slug),
  });

  const feedbackMutation = useMutation({
    mutationFn: (resolved: boolean) =>
      apiFetch(`/api/v1/articles/${query.data!.id}/feedback`, {
        method: "PUT",
        body: JSON.stringify({ resolved }),
      }),
    onSuccess: (_data, resolved) => {
      setFeedbackMessage(
        resolved
          ? "Obrigado pelo feedback. Ficamos felizes que o artigo ajudou."
          : "Feedback registrado. Voce pode abrir um chamado para receber ajuda.",
      );
      queryClient.invalidateQueries({
        queryKey: ["user", user?.id, "article", slug],
      });
    },
  });

  if (query.isLoading) return <LoadingState label="Carregando artigo..." />;
  if (query.isError) {
    const message =
      query.error instanceof ApiError
        ? query.error.message
        : "Erro ao carregar o artigo.";
    return <ErrorState message={message} onRetry={() => query.refetch()} />;
  }

  const article = query.data!;

  function handleNotResolved() {
    feedbackMutation.mutate(false);
    navigate("/chamados/novo", {
      state: { title: article.title, category: article.category },
    });
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        {article.title}
      </Typography>
      <Typography sx={{ whiteSpace: "pre-line", mb: 3 }}>
        {article.content}
      </Typography>

      <Typography variant="subtitle1" gutterBottom>
        Este artigo resolveu sua duvida?
      </Typography>
      {feedbackMessage && (
        <Alert severity="success" sx={{ mb: 2 }} aria-live="polite">
          {feedbackMessage}
        </Alert>
      )}
      <Box sx={{ display: "flex", gap: 2 }}>
        <Button
          variant="contained"
          color="success"
          onClick={() => feedbackMutation.mutate(true)}
          disabled={feedbackMutation.isPending}
        >
          Sim, resolveu
        </Button>
        <Button
          variant="outlined"
          color="warning"
          onClick={handleNotResolved}
          disabled={feedbackMutation.isPending}
        >
          Nao resolveu, abrir chamado
        </Button>
      </Box>
    </Paper>
  );
}
