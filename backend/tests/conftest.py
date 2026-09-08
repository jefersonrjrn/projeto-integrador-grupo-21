import os

# Configuracao ficticia somente para importacao: os testes de fundacao
# substituem a dependencia de banco e nao abrem conexoes PostgreSQL.
os.environ["DATABASE_URL"] = "postgresql+psycopg://test:test@127.0.0.1:1/test"
os.environ["JWT_SECRET"] = "foundation-test-secret-not-for-real-use"
