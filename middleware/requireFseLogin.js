const jwt = require("jsonwebtoken");
const poolPromise = require("../util/connnectionPromise");

module.exports = async (req, res, next) => {
  const { authorization, key } = req.headers;
  if (!key) {
    return res.status(422).json({ error: "Please provide an API key" });
  }
  if (!authorization) {
    return res
      .status(422)
      .json({status_code: "2", status: "failed",  error: "Unauthorization" });
  }
  const token = authorization.replace("Bearer ", "");
  jwt.verify(token, process.env.JWT_KEYS, async (err, payload) => {
    if (err) {
      return res.status(422).json({ error: err });
    }
    const { id: unique_id, secret: secret_key } = payload;

    const connection = await poolPromise().getConnection();

    const [users] = await connection.query(
      "SELECT * FROM fse WHERE unique_id = ?",
      [unique_id]
    );

    if (users.length === 0) {
      connection.release();
      return res
        .status(400)
        .json({ status: "fail", message: "No users is found" });
    }
    console.log(users[0].key, secret_key, users[0].key === secret_key);
    if (users[0].secretkey === secret_key) {
      connection.release();
      req.login = users[0];
      req.secret_key = secret_key;
      next();
    } else {
      return res
        .status(422)
        .json({status_code: "2", status: "failed",  message: "Token expired" });
    }
  });
};
