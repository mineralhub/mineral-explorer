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
    to_address      TEXT,
    created_time    TIMESTAMP,
    data            JSON,
    hash            TEXT,
    block_height    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
    address         TEXT NOT NULL PRIMARY KEY,
    balance         BIGINT
);