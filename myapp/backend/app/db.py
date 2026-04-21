import sqlite3

DB_NAME = "inventory.db"

def get_connection():
    connectDB = sqlite3.connect(DB_NAME)
    connectDB.row_factory = sqlite3.Row
    return connectDB

def create_table():
    connectDB = get_connection()
    cursor = connectDB.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS INVENTORY (
        DATE TEXT,
        NAME TEXT,
        TRACKING INTEGER,
        EBAYID INTEGER,
        QUANTITY INTEGER,
        TOTALCOST INTEGER,
        SERIALNUMBER INTEGER,
        LOGGEDBY TEXT,
        NOTES TEXT
    )
    """)

    connectDB.commit()
    connectDB.close()

def insert_inventory(date, name, tracking, ebayid, quantity, totalcost, serialnumber, loggedby, notes):
    connectDB = get_connection()
    cursor = connectDB.cursor()

    cursor.execute("""
    INSERT INTO INVENTORY (
        DATE, NAME, TRACKING, EBAYID, QUANTITY,
        TOTALCOST, SERIALNUMBER, LOGGEDBY, NOTES
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (date, name, tracking, ebayid, quantity, totalcost, serialnumber, loggedby, notes))

    connectDB.commit()
    connectDB.close()

def get_inventory():
    connectDB = get_connection()
    cursor = connectDB.cursor()

    cursor.execute("SELECT * FROM INVENTORY")
    rows = cursor.fetchall()

    connectDB.close()
    return [dict(row) for row in rows]