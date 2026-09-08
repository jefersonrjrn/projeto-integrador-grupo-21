import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Typography,
} from "@mui/material";

export function LoadingState({ label = "Carregando..." }: { label?: string }) {
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{ display: "flex", gap: 2, alignItems: "center", py: 4 }}
    >
      <CircularProgress size={24} />
      <Typography>{label}</Typography>
    </Box>
  );
}

export function EmptyState({
  message,
  action,
}: {
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <Box sx={{ py: 4 }}>
      <Typography color="text.secondary" gutterBottom>
        {message}
      </Typography>
      {action}
    </Box>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Alert
      severity="error"
      action={
        <Button color="inherit" size="small" onClick={onRetry}>
          Tentar novamente
        </Button>
      }
      sx={{ my: 2 }}
    >
      {message}
    </Alert>
  );
}
