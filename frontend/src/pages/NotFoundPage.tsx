import { Link } from "react-router-dom";
import { Box, Button, Typography } from "@mui/material";

export default function NotFoundPage() {
  return (
    <Box sx={{ textAlign: "center", py: 8 }}>
      <Typography variant="h4" gutterBottom>
        Pagina nao encontrada
      </Typography>
      <Button component={Link} to="/" variant="contained">
        Voltar ao inicio
      </Button>
    </Box>
  );
}
