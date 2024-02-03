const express = require("express");
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const app = express();
const port = 3000;
const password = "adwawd";
let TOKEN;

app.set("views", path.join(__dirname, "views"));
app.use(express.static(__dirname + "/static"));
app.use(express.json({ limit: "1000000mb" }));
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept",
  );
  next();
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});

app.get("/chats", (req, res) => {
  getConversations((data) => {
    res.json(data);
  });
});

app.get("/isTokenPresent", (req, res) => {
  try {
    const content = fs.readFileSync("gptdrive.json", "utf8");
    const data = JSON.parse(content);
    if (
      "token" in data &&
      "salt" in data.token &&
      "iv" in data.token &&
      "encryptedData" in data.token &&
      "iterations" in data.token &&
      "authTag" in data.token
    ) {
      res.json(true);
    } else {
      res.json(false);
    }
  } catch (e) {
    res.json(false);
  }
});

app.post("/setToken", (req, res) => {
  const { token } = req.body;
  getConversations((data) => {
    if (data.error) {
      res.json({ error: true, success: false });
    } else {
      addToSaveEncrypted("token", token);
      res.json({ success: true, error: false });
    }
  }, token);
});

app.get("/tokenReadRequest", (req, res) => {
  TOKEN = readData();
  res.json({ success: true });
});

function generateRandomString() {
  const currentTimeStamp = new Date().getTime();
  const timeString = currentTimeStamp.toString(36);
  const randomPart = Math.random().toString(36).substr(2, 5);
  const resultString = `${timeString}-${randomPart}`;
  return resultString;
}

app.post("/upload", (req, res) => {
  const fileContent = req.body.file;
  const id = generateRandomString();
  const convo = req.body.convo;
  const name = req.body.name;
  const size = req.body.size;

  if (!convo)
    return res.json({ success: false, message: "No conversation ID!" });

  if (!fileContent) {
    return res.json({ success: false, error: "No file received" });
  }

  const chunkSize = 500;
  const chunks = [];

  for (let i = 0; i < fileContent.length; i += chunkSize) {
    chunks.push(
      "GPTDRIVEWEB" +
        id +
        "AXO(" +
        String(Number(Math.ceil(i / chunkSize)) + 1) +
        "/" +
        Math.ceil(fileContent.length / chunkSize) +
        ")" +
        fileContent.substring(i, i + chunkSize),
    );
  }

  appendToSave(convo, id, [name, size]);
  let time = 500;

  chunks.forEach((chunk) => {
    setTimeout(() => {
      upload(convo, chunk);
    }, time);
    time += 2000;
  });

  res.json({ success: true });
});

app.get("/drive/:convo", (req, res) => {
  const convo = req.params.convo;
  const data = readJSON();
  res.json(data[convo] || {});
});

app.get("/download/:convo/:id/:name", (req, res) => {
  const id = req.params.id;
  const name = req.params.name;
  const convo = req.params.convo;
  allDriveContent(convo, (jsonData) => {
    const idToFind = id;

    const filteredMessages = Object.keys(jsonData.mapping)
      .filter(
        (key) =>
          jsonData.mapping[key].message &&
          jsonData.mapping[key].message.author &&
          jsonData.mapping[key].message.author.role === "user" &&
          jsonData.mapping[key].message.content &&
          jsonData.mapping[key].message.content.parts &&
          jsonData.mapping[key].message.content.parts[0] &&
          jsonData.mapping[key].message.content.parts[0].startsWith(
            `GPTDRIVEWEB${idToFind}AXO`,
          ),
      )
      .map((key) => jsonData.mapping[key].message.content.parts[0]);

    const sortedMessages = filteredMessages
      .sort((a, b) => {
        const regex = /GPTDRIVEWEB.*AXO(\d+)\/(\d+)/;
        const matchA = a.match(regex);
        const matchB = b.match(regex);

        if (matchA && matchB) {
          const [, , numA] = matchA;
          const [, , numB] = matchB;
          return parseInt(numA) - parseInt(numB);
        } else {
          return 0;
        }
      })
      .map((message) => message.replace(/.*AXO/, "").replace(/.*\)/, ""));

    fs.writeFileSync(name, sortedMessages.join());
  });
});

function allDriveContent(convo, cb) {
  try {
    fetch("https://chat.openai.com/backend-api/conversation/" + convo, {
      headers: {
        accept: "*/*",
        "accept-language": "en-US",
        authorization: "Bearer " + TOKEN,
        "sec-ch-ua":
          '"Not A(Brand";v="99", "Brave";v="121", "Chromium";v="121"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "sec-gpc": "1",
      },
      referrer: "https://chat.openai.com/c/" + convo,
      referrerPolicy: "strict-origin-when-cross-origin",
      body: null,
      method: "GET",
      mode: "cors",
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        cb(data);
      });
  } catch (e) {
    allDriveContent(convo);
  }
}

function upload(id, data) {
  return new Promise((resolve, reject) => {
    try {
      fetch("https://chat.openai.com/backend-api/conversation", {
        headers: {
          accept: "text/event-stream",
          "accept-language": "en-US",
          authorization: "Bearer " + TOKEN,
          "content-type": "application/json",
          "sec-ch-ua":
            '"Not_A Brand";v="8", "Chromium";v="120", "Brave";v="120"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "sec-gpc": "1",
        },
        referrerPolicy: "strict-origin-when-cross-origin",
        body: JSON.stringify({
          action: "next",
          messages: [
            {
              author: {
                role: "user",
              },
              content: {
                content_type: "text",
                parts: [data],
              },
              metadata: {},
            },
          ],
          conversation_id: id,
          model: "text-davinci-002-render-sha",
          timezone_offset_min: -360,
          suggestions: [],
          history_and_training_disabled: false,
          arkose_token: null,
          conversation_mode: {
            kind: "primary_assistant",
          },
          force_paragen: false,
          force_rate_limit: false,
        }),
        method: "POST",
        mode: "cors",
        credentials: "include",
      })
        .then((res) => res.text())
        .then((x) => {
          console.log("Uploaded chunk...");
          resolve(x);
        });
    } catch (e) {
      reject(e);
    }
  });
}

function getConversations(cb, token = TOKEN) {
  try {
    fetch(
      "https://chat.openai.com/backend-api/conversations?offset=0&limit=28&order=updated",
      {
        headers: {
          accept: "*/*",
          "accept-language": "en-US",
          authorization: "Bearer " + token,
          "sec-ch-ua":
            '"Not A(Brand";v="99", "Brave";v="121", "Chromium";v="121"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "sec-gpc": "1",
        },
        referrer:
          "https://chat.openai.com/c/cc9c16b4-9018-48b4-8493-36564699ae1b",
        referrerPolicy: "strict-origin-when-cross-origin",
        body: null,
        method: "GET",
        mode: "cors",
        credentials: "include",
      },
    )
      .then((res) => res.json())
      .then((data) => {
        cb(data);
      });
  } catch (e) {
    setTimeout(() => {
      getConversations(cb, token);
    }, 1000);
  }
}

function readJSON() {
  let existingData = {};
  try {
    const fileContent = fs.readFileSync("gptdrive.json", "utf8");
    existingData = JSON.parse(fileContent);
  } catch (err) {
    existingData = {};
  }
  return existingData;
}

function readData(name = "token") {
  try {
    const jsonData = readJSON();
    if (!jsonData[name]) {
      return false;
    }
    const { salt, iv, encryptedData, authTag, iterations } = jsonData[name];
    const decryptedToken = decrypt(
      encryptedData,
      iv,
      authTag,
      salt,
      iterations,
    );
    return decryptedToken;
  } catch (error) {
    console.error("Error reading token:", error);
    return null;
  }
}

function encrypt(token) {
  const salt = crypto.randomBytes(16);
  const iterations = 100000;
  const keyLength = 32;

  const key = crypto.pbkdf2Sync(
    password,
    salt,
    iterations,
    keyLength,
    "sha256",
  );
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(token, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();
  return {
    salt: salt.toString("hex"),
    iv: iv.toString("hex"),
    iterations: iterations,
    encryptedData: encrypted,
    authTag: authTag.toString("hex"),
  };
}

function decrypt(encryptedData, iv, authTag, salt, iterations) {
  const key = crypto.pbkdf2Sync(
    password,
    Buffer.from(salt, "hex"),
    iterations,
    32,
    "sha256",
  );

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(iv, "hex"),
  );
  decipher.setAuthTag(Buffer.from(authTag, "hex"));

  let decrypted = decipher.update(encryptedData, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

function addToSave(key, value) {
  let existingData = {};
  try {
    const fileContent = fs.readFileSync("gptdrive.json", "utf8");
    existingData = JSON.parse(fileContent);
  } catch (err) {
    existingData = {};
  }
  existingData[key] = value;
  fs.writeFileSync("gptdrive.json", JSON.stringify(existingData));
}

function appendToSave(key, id, list) {
  let existingData = {};
  try {
    const fileContent = fs.readFileSync("gptdrive.json", "utf8");
    existingData = JSON.parse(fileContent);
  } catch (err) {
    existingData = {};
  }
  if (key in existingData) {
    existingData[key][id] = list;
  } else {
    existingData[key] = {};
    existingData[key][id] = list;
  }
  fs.writeFileSync("gptdrive.json", JSON.stringify(existingData));
}

function addToSaveEncrypted(name, data) {
  addToSave(name, encrypt(data));
}

app.listen(port, () => {
  console.log(`app is running at http://localhost:${port}`);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection:", reason);
});
