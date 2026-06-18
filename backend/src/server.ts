import "dotenv/config";
import app from "./app";

const PORT = parseInt(process.env.PORT || "8000", 10);

app.listen(PORT, () => {
  console.log(`\n✨ StudioFlow API rodando em http://localhost:${PORT}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV || "development"}`);
  console.log("   Pressione Ctrl+C para parar.\n");
});
