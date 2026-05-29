import sqlite3
import pandas as pd

#DB_NAME = "inventory.db"
DB_NAME = "/Users/saulmoreno/Documents/GitHub/InventoryControl/myapp/backend/app/inventory.db"
CSV_FILE = "Sheet1.csv"

df = pd.read_csv(CSV_FILE)

conn = sqlite3.connect(DB_NAME)

#python csvImport.py to add it to the database
#will add repeat rows
#df.to_sql("INVENTORY", conn, if_exists="append", index=False)
#this will replace old data with the new one. kind of. do more digging
#Replace table each time (clean reset)
df.to_sql("INVENTORY", conn, if_exists="replace", index=False)
conn.close()

print("✅ Data inserted into INVENTORY table.")