function fnv1a64FromBytes(bytes) {
  let h = BigInt("0xcbf29ce484222325"); // offset basis
  const prime = BigInt("0x100000001b3");

  for (let i = 0; i < bytes.length; i++) {
    h ^= BigInt(bytes[i]); // use the byte directly
    h = (h * prime) & BigInt("0xFFFFFFFFFFFFFFFF"); // force 64-bit overflow
  }

  // Return 16-char hex (8 bytes)
  return h.toString(16).padStart(16, "0");
}

class tracked_file {
  constructor(filename, stored_name, last_change, hash) {
    this.filename = filename;
    this.stored_name = stored_name;
    this.last_change = last_change;
    this.hash = hash;
  }
}

class transaction {
  constructor(id) {
    this.id = id;
    this.status = "pending"; //pending, commit, modules, ok
    this.last_time_update = Date.now();
    this.files = [];
  }
}

function parseBlob(blob) {
  // Convert byte blob to UTF-8 string
  try {
    const text = new TextDecoder().decode(blob);

    // Split the text into parts
    const parts = text.split(":::");

    // Each file entry has 4 fields: filename, stored_name, last_change, hash
    const files = [];
    for (let i = 0; i < parts.length - 1; i += 4) {
      const [filename, stored_name, last_change, hash] = parts.slice(i, i + 4);
      if (filename && stored_name && last_change && hash) {
        files.push(new tracked_file(filename, stored_name, last_change, hash));
      }
    }

    return files;
  } catch (error) {
    throw new Error("Failed to parse blob: " + error.message);
  }
}

class transaction_handler {
  constructor() {
    this.transactions = new Map();
  }

  createTransaction(blob) {
    try {
      const hash = fnv1a64FromBytes(blob);
      const tx = new transaction(hash);
      tx.files = parseBlob(blob);
      this.transactions.set(hash, tx);
    } catch (error) {
      throw error;
    }
  }
}

module.exports = transaction_handler;
