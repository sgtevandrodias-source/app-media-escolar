CREATE TABLE IF NOT EXISTS licencas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chave TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'ativa',
  device_1 TEXT,
  device_2 TEXT,
  ativada_1_em TEXT,
  ativada_2_em TEXT,
  criada_em TEXT DEFAULT CURRENT_TIMESTAMP,
  observacao TEXT
);
