const express = require("express");
const app = express();
// Importing process module
const process = require("process");
require("dotenv").config();
const PORT = process.env.PORT || 5000;
console.log({ PORT });
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const moment = require("moment-timezone");
const morgan = require("morgan");
const poolPromise = require("./util/connnectionPromise");
const uuid = require("uuid");

const common = require("./routes/common.js");
const authAdminRoutes = require("./routes/auth.js");
const admin = require("./routes/admin.js");
const employee = require("./routes/employee.js");
const erp = require("./routes/erp.js");
const onboard = require("./routes/marchentonbord.js");
const md5 = require("md5");
const { platform } = require("os");
const { access } = require("fs");

async function checkDatabaseConnection() {
  try {
    const connectionUser = await poolPromise().getConnection();
    const query = "SELECT table_name FROM information_schema.tables";
    await connectionUser.query(query);
    console.log("db running");
    return true;
  } catch (error) {
    console.error("Failed to establish database connection: ", error.message);
    return false;
  }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
app.set("trust proxy", true);

// for cross platform header start

// app.use(function(req, res, next) {
//   res.setHeader("Access-Control-Allow-Origin", "*");
//   res.setHeader("Access-Control-Allow-Credentials", "true");
//   res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT,PATCH");
//   res.setHeader("Access-Control-Allow-Headers", "Access-Control-Allow-Headers, Origin, Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers, x-access-token");
//   next();
// });

// for cross platform header end

app.get("/a", (req, res) => {
  const clientIp = req.ip; // Get the client IP address
  console.log("Client IP:", clientIp);
  res.send("Hello from the server!");
});

app.use((req, res, next) => {
  // Retrieve the client's IP address from X-Forwarded-For header
  const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  // Store the client's IP address in the request object
  req.clientIp = clientIp;
  // Continue to the next middleware or route handler
  next();
});

morgan.token("date", (req, res, tz) => {
  return moment().tz(tz).format("DD-MM-YYYY, hh:mm a");
});

// Define a custom token for morgan to get client's IP
morgan.token("client-ip", (req, res) => {
  return req.headers["x-forwarded-for"] || req.socket.remoteAddress;
});

morgan.token("ip", (req, res, tz) => {
  return req.clientIp || req.ip || "-";
});
morgan.format(
  "myformat",
  '[:client-ip] [:date[Asia/Calcutta]] ":method :url HTTP/:http-version" :status :res[content-length] - :response-time ms'
);
app.use(morgan("myformat"));

// Serve static assets
app.use("/assets", express.static(path.join(__dirname, "assets/image")));
const captureResponse = (req, res, next) => {
  // Store the original `res.send` function
  const originalSend = res.send;

  // Override the `res.send` function
  res.send = function (body) {
    // Capture the response data here
    console.log("Response captured:", body);

    // Call the original `res.send` function to send the response
    originalSend.call(this, body);
  };

  // Proceed to the next middleware or route handler
  next();
};

//fetch key start

app.get("/getkey/:type", async (req, res) => {
  // Use promise-based connection
  const connection = await poolPromise().getConnection();
  try {
    const { type } = req.params;

    // Validate the type
    if (type !== "web" && type !== "app") {
      return res.status(400).json({
        status_code: "2",
        status: "failed",
        message: "Invalid type. Type must be 'web' or 'app'.",
      });
    }

    let secKey = null;

    // Fetch secret key from the database
    let sql = "SELECT * FROM secret_key WHERE status = 'Active'";
    if (type === "web") {
      sql += " AND type = 'web'";
    } else if (type === "app") {
      sql += " AND type = 'app'";
    }

    const [data] = await connection.query(sql);

    const expirationDate = new Date();
    expirationDate.setHours(expirationDate.getHours() + 24);

    if (data.length > 0) {
      const secretKeyData = data[0];
      secKey = secretKeyData.secret_key;

      // Check if the secret key is expired
      const currentDateTime = new Date();

      if (secretKeyData.expired && secretKeyData.expired < currentDateTime) {
        // Update the status of the expired secret key to 'Expired'
        sql = "UPDATE secret_key SET status = 'Expired' WHERE id = ?";
        await connection.query(sql, [secretKeyData.id]);

        // Generate a new secret key
        secKey = md5(uuid.v4()).slice(0, 16);

        // Insert the new secret key into the secret_key table
        sql =
          "INSERT INTO secret_key (expired, type, created_at, secret_key, status) VALUES (?, ?, NOW(), ?, 'Active')";
        const values = [expirationDate, type, secKey];
        await connection.query(sql, values);
      }
    } else {
      // Generate a new secret key
      secKey = md5(uuid.v4()).slice(0, 16);

      // Insert the new secret key into the secret_key table
      sql =
        "INSERT INTO secret_key (expired, type, created_at, secret_key, status) VALUES (?, ?, NOW(), ?, 'Active')";
      const values = [expirationDate, type, secKey];
      await connection.query(sql, values);
    }

    res.status(200).json({
      status_code: "1",
      status: "success",
      secret_key: secKey,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Internal Server Error",
    });
  } finally {
    if (connection) {
      await connection.release();
    }
  }
});

//fetch key end

// apikey middleware
app.use(async (req, res, next) => {
  try {
    var apikey = req.headers.key;
    if (!apikey) {
      return res.status(422).json({ error: "Please provide an API key" });
    }

    const connection = await poolPromise().getConnection();

    try {
      const [fetchedKey] = await connection.query(
        "SELECT id FROM secret_key WHERE secret_key = ? AND status = 'Active' ",
        [apikey]
      );

      if (fetchedKey.length === 0) {
        return res.status(422).json({
          status: "failed",
          message: "INVALID API KEY",
        });
      } else {
        next();
      }
    } catch (err) {
      return res.status(422).json({ status: "fail", error: err });
    } finally {
      connection.release();
    }
  } catch (error) {
    return res.status(422).json({
      status: "failed",
      message: "INVALID API KEY",
    });
  }
});

// Routes

app.use("/common", common);
app.use("/", authAdminRoutes);
app.use("/", admin);
app.use("/erp", erp);
app.use("/employee", employee);
app.use("/", onboard);

// Default route
app.get("/", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.send("hello");
});

// Universal route for handling unknown requests
app.use((req, res) => {
  res.status(404).send("404 - Not Found");
});

// Event 'warning'
process.on("warning", (warning) => {
  console.warn("warning stacktrace - " + warning.stack);
});

// Start the server
async function startServer() {
  const databaseConnectionSuccessful = await checkDatabaseConnection();
  if (databaseConnectionSuccessful) {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } else {
    console.error(`Failed to start Server due to database connection error`);
  }
}

startServer();
// const NodeRSA = require('node-jsencrypt');
// const rsa = new NodeRSA();

// const publicKey = 'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCaFyrzeDhMaFLx+LZUNOOO14Pj9aPfr+1WOanDgDHxo9NekENYcWUftM9Y17ul2pXr3bqw0GCh4uxNoTQ5cTH4buI42LI8ibMaf7Kppq9MzdzI9/7pOffgdSn+P8J64CJAk3VrVswVgfy8lABt7fL8R6XReI9x8ewwKHhCRTwBgQIDAQAB';

// rsa.setPublicKey(publicKey);

// const plaintext = '883937444774';
// const encrypted = rsa.encrypt(plaintext, 'base64');

// console.log("Encrypted:", encrypted);


//const crypto = require('crypto');

// async function calculateRSA(salt) {
//     const publicKey = `MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCXa63O/UXt5S0Vi8DM/PWF4yugx2OcTVbcFPLfXmLm9ClEVJcRuBr7UDHjJ6gZgG/qcVez5r6AfsYl2PtKmYP3mQdbR/BjVOjnrRooXxwyio6DFk4hTTM8fqQGWWNm6XN5XsPK5+qD5Ic/L0vGrS5nMWDwjRt59gzgNMNMpjheBQIDAQAB`;

//     const buffer = Buffer.from(salt, 'utf-8');
//     const encrypted = crypto.publicEncrypt({ key: publicKey, padding: crypto.constants.RSA_PKCS1_PADDING }, buffer);
//     const encodedMessage = encrypted.toString('base64');
//     return encodedMessage;
// }

// (async () => {
//   try {
//       const encodedMessage = await calculateRSA(process.env.SALT);
//       console.log(encodedMessage);
//   } catch (error) {
//       console.log(error);
//   }
// })();
// const crypto = require('crypto');

// function calculateRSA(salt) {
//   const publicKey = getPublicKey();
//   const buffer = Buffer.from(salt, 'utf-8');
//   const encrypted = crypto.publicEncrypt({ key: publicKey, padding: crypto.constants.RSA_PKCS1_PADDING }, buffer);
//   const encodedMessage = encrypted.toString('base64');
//   return encodedMessage;
// }

// function getPublicKey() {
//   const rawPublicKey = "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCXa63O/UXt5S0Vi8DM/PWF4yugx2OcTVbcFPLfXmLm9ClEVJcRuBr7UDHjJ6gZgG/qcVez5r6AfsYl2PtKmYP3mQdbR/BjVOjnrRooXxwyio6DFk4hTTM8fqQGWWNm6XN5XsPK5+qD5Ic/L0vGrS5nMWDwjRt59gzgNMNMpjheBQIDAQAB";
//   const keyBytes = Buffer.from(rawPublicKey, 'base64');
//   const spec = new crypto.X509EncodedKeySpec(keyBytes);
//   const kf = crypto.KeyFactory('RSA');
//   return kf.generatePublic(spec);
// }

// (async () => {
//   try {
//     const value = await calculateRSA(process.env.SALT);
//     console.log(value);
//   } catch (error) {
//     console.error(error);
//   }
// })();

// const crypto = require('crypto');
// const publicKey = 'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCaFyrzeDhMaFLx+LZUNOOO14Pj9aPfr+1WOanDgDHxo9NekENYcWUftM9Y17ul2pXr3bqw0GCh4uxNoTQ5cTH4buI42LI8ibMaf7Kppq9MzdzI9/7pOffgdSn+P8J64CJAk3VrVswVgfy8lABt7fL8R6XReI9x8ewwKHhCRTwBgQIDAQAB';

// // Step 1: Decode the public key
// const decodedPublicKey = Buffer.from(publicKey, 'base64').toString('ascii');

// // Step 2: Compute RSA encrypted signature using the decoded key and message
// const message = '883937444774';
// const encryptedSignature = crypto.publicEncrypt(
//   { key: decodedPublicKey, padding: crypto.constants.RSA_PKCS1_PADDING },
//   Buffer.from(message, 'utf8')
// );

// // Step 3: Encode the encrypted signature with base64 encoding
// const base64EncodedSignature = encryptedSignature.toString('base64');

// console.log(base64EncodedSignature);

