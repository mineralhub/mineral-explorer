CREATE TABLE IF NOT EXISTS blocks (
    height          INTEGER NOT NULL PRIMARY KEY,
    transactions    INTEGER,
    hash            TEXT,
    prevhash        TEXT
);

CREATE TABLE IF NOT EXISTS transactions (
    version         SMALLINT,
    type            SMALLINT,
    created_time    TIMESTAMP,
    data            JSON,
    hash            TEXT
);