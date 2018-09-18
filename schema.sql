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
    created_time    TIMESTAMP,
    data            JSON,
    hash            TEXT
);