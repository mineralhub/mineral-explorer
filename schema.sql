DROP TABLE IF EXISTS blocks;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS txindex;
DROP TABLE IF EXISTS delegates;

CREATE TABLE IF NOT EXISTS blocks (
    height          INTEGER NOT NULL PRIMARY KEY,
    version         SMALLINT,
    transactions    INTEGER,
    hash            TEXT,
    prevhash        TEXT,
    created_time    TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
    version         SMALLINT,
    type            SMALLINT,
    from_address    TEXT,
    created_time    TIMESTAMP,
    data            JSON,
    hash            TEXT,
    block_height    INTEGER NOT NULL,
    sub_data        JSON
);

CREATE TABLE IF NOT EXISTS accounts (
    address         TEXT NOT NULL PRIMARY KEY,
    balance         BIGINT DEFAULT 0,
    lock            BIGINT DEFAULT 0,
    vote            JSON
);

CREATE TABLE IF NOT EXISTS txindex (
    address         TEXT NOT NULL,
    hash            TEXT,
    num             BIGSERIAL
);
CREATE INDEX idx_address ON txindex(address);

CREATE TABLE IF NOT EXISTS delegates (
    address         TEXT NOT NULL PRIMARY KEY,
    name            TEXT,
    total_vote      BIGINT DEFAULT 0,
    round_vote      BIGINT DEFAULT 0
);