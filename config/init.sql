CREATE USER hydra WITH PASSWORD 'ChangeMe!';
CREATE DATABASE hydra;
GRANT ALL PRIVILEGES ON DATABASE hydra TO hydra;
\c hydra
GRANT ALL ON SCHEMA public TO hydra;

CREATE USER kratos WITH PASSWORD 'ChangeMe!';
CREATE DATABASE kratos;
GRANT ALL PRIVILEGES ON DATABASE kratos TO kratos;
\c kratos
GRANT ALL ON SCHEMA public TO kratos;

CREATE USER keto WITH PASSWORD 'ChangeMe!';
CREATE DATABASE accesscontroldb;
GRANT ALL PRIVILEGES ON DATABASE accesscontroldb TO keto;
\c accesscontroldb
GRANT ALL ON SCHEMA public TO keto;
