const jwt = require('jsonwebtoken');
const JWT_KEYS  = process.env.JWT_KEYS;
const poolPromise = require("../util/connnectionPromise");


module.exports = async (req, res, next) => {
  const { authorization, key } = req.headers;

  if (!authorization) {
    return res.status(422).json({ error: "You must be logged in" });
  }

  const token = authorization.replace("Bearer ", "");

  try {
    const payload = jwt.verify(token, JWT_KEYS);
    const { unique_id, secret_key } = payload;
    console.log(unique_id, secret_key);
    const connection = await poolPromise().getConnection();

    try {
      const [fetchedKey] = await connection.query(
        "SELECT id FROM secret_key WHERE secret_key = ?",
        [key]
      );

      if (fetchedKey.length === 0) {
        return res
          .status(422)
          .json({ status: "fail", message: "Invalid API key" });
      }

      const [savedData] = await connection.query(
        "SELECT * FROM admin WHERE admin.unique_id = ? AND admin.secret = ?",
        [unique_id, secret_key]
      );
        console.log(unique_id, secret_key);
      if (savedData.length === 0) {
        return res
          .status(400)
          .json({
            status: "fail",
            message: "Token expired, please log in again",
          });
      }

      const adminDetails = {
        adminid: savedData[0].id,
        unique_id: savedData[0].unique_id,
        accountid: savedData[0].accountid,
        name: savedData[0].name,
        mobile: savedData[0].contact,
        email: savedData[0].email,
        password: savedData[0].password,
        status: savedData[0].status,
      };

      req.admin = adminDetails; 
      next();
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ status: "fail", message: "Internal server error" });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error(error);
    res.status(422).json({ error: "You must be logged in." });
  }
};