import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Grid,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";

import { apiFetch, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { LoadingState, EmptyState, ErrorState } from "../components/AsyncState";
import type { ArticleCategory, ArticleSummary } from "../types/domain";

const CATEGORIES: { value: ArticleCategory | ""; label: string }[] = [
  { value: "", label: "Todas as categorias" },
  { value: "ACCESS", label: "Acesso" },
  { value: "SOFTWARE", label: "Software" },
  { value: "NETWORK", label: "Rede" },
  { value: "HARDWARE", label: "Hardware" },
  { value: "SECURITY", label: "Seguranca" },
];

export default function ArticlesPage() {
  const { user } = useAuth();
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ArticleCategory | "">("");

  const query = useQuery({
    queryKey: ["user", user?.id, "articles", search, category],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (category) params.set("category", category);
      return apiFetch<ArticleSummary[]>(
        `/api/v1/articles?${params.toString()}`,
      );
    },
  });

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    setSearch(searchDraft.trim());
  }

  return (
    <>
      <Typography variant="h5" gutterBottom>
        Base de conhecimento
      </Typography>

      <Box
        component="form"
        onSubmit={handleSearch}
        role="search"
        sx={{ mb: 2 }}
      >
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6}>
            <TextField
              label="Pesquisar artigos"
              type="search"
              fullWidth
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              select
              label="Categoria"
              fullWidth
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as ArticleCategory | "")
              }
            >
              {CATEGORIES.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={2}>
            <Button type="submit" variant="contained" fullWidth>
              Buscar
            </Button>
          </Grid>
        </Grid>
      </Box>

      {query.isLoading && <LoadingState label="Carregando artigos..." />}
      {query.isError && (
        <ErrorState
          message={
            query.error instanceof ApiError
              ? query.error.message
              : "Erro ao carregar artigos."
          }
          onRetry={() => query.refetch()}
        />
      )}
      {query.data && query.data.length === 0 && (
        <EmptyState message="Nenhum artigo encontrado para essa busca." />
      )}

      <Grid container spacing={2}>
        {query.data?.map((article) => (
          <Grid item xs={12} sm={6} md={4} key={article.id}>
            <Card>
              <CardActionArea component={Link} to={`/ajuda/${article.slug}`}>
                <CardContent>
                  <Chip label={article.category} size="small" sx={{ mb: 1 }} />
                  <Typography variant="h6">{article.title}</Typography>
                  <Typography color="text.secondary" variant="body2">
                    {article.summary}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </>
  );
}
