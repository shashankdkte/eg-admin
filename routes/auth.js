const express = require("express");
const router = express.Router();
const uuid = require("uuid");
const poolPromise = require("../util/connnectionPromise");
const md5 = require("md5");
const SALT = process.env.SALT;
const JWT_KEYS = process.env.JWT_KEYS;
const jwt = require("jsonwebtoken");
const smsapi = require("../globalfunction/sms");
const path = require("path");
const multer = require("multer");
const moment = require("moment-timezone");
moment().tz("Asia/Calcutta").format();

// Configure multer storage for file uploads
const storages = multer.diskStorage({
  destination: "./assets/image/employeedosc",
  filename: (req, file, cb) => {
    return cb(
      null,
      `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`
    );
  },
});

const upload = multer({
  storage: storages,
  fileFilter: (req, file, cb) => {
    const allowedFileTypes = /jpeg|jpg|png|pdf|text/; // Adjust the allowed file types as per your requirements
    const extname = allowedFileTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedFileTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb("Error: Only jpeg, jpg, png, and pdf files are allowed.");
    }
  },
});

// auth Admin Login start

router.post("/login", async (req, res) => {
  // Use promise-based connection
  const connection = await poolPromise().getConnection();
  try {
    const key = req.headers.key;
    const { mobile, password, mac_id } = req.body;

    console.log(
      mobile,
      password,
      mac_id,
      typeof password,
      " mobile, password, mac_id"
    );
    if (!mobile || !password) {
      return res.status(422).json({
        status_code: "2",
        status: "failed",
        message: "Please provide all fields",
      });
    }

    var otp = Math.floor(100000 + Math.random() * 9000); //changed 4 to 6 digit otp
    let saltedOTP = SALT.concat(otp);
    var hashedOTP = md5(saltedOTP);

    // Check secret key
    const sql = "SELECT id FROM secret_key WHERE secret_key = ?";
    const value = [key];
    const [fetchedKey] = await connection.query(sql, value);

    if (fetchedKey.length === 0) {
      return res
        .status(422)
        .json({ status_code: "2", status: "failed", message: "INVALID API KEY" });
    } else {
      // Fetch admin details
      const sql1 = "SELECT * FROM admin WHERE contact = ?";
      const value1 = [mobile];
      const [savedUser] = await connection.query(sql1, value1);

      console.log("key", fetchedKey, "key");
      console.log("mobile", mobile, "mobile");

      if (savedUser.length === 0) {
        return res.status(422).json({
          status_code: "2",
          status: "failed",
          message: "Invalid Mobile number",
        });
      }

      const secret = (Math.random() + 1).toString(36).substring(2);
      const status = parseInt(savedUser[0].status);
     
      if (status === 0) {
        console.log(
          password === savedUser[0].password,
          "password === savedUser[0].password"
        );
        return res.status(422).json({
          status_code: "2",
          status: "failed",
          message: "Your account is blocked..",
        });
      }
      else if (status === 1)
      {
        if (password === savedUser[0].password) {
          const Mac_id = savedUser[0].mac_id;
          if (Mac_id === mac_id) {
            const token = jwt.sign(
              { unique_id: savedUser[0].unique_id, secret_key: secret },
              JWT_KEYS
            );
            await connection.query(
              "UPDATE admin SET admin.secret = ? WHERE admin.contact = ?",
              [secret, mobile]
            );

            // added .status(200)
            return res.status(200).json({
              status_code: "1",
              status: "success",
              Data: {
                "account id": savedUser[0].accountid,
                name: savedUser[0].name,
                role: savedUser[0].role,
                status: savedUser[0].status,
                token: token,
              },
            });
          } else {
            await connection.query(
              "UPDATE admin SET admin_otp = ?, admin.secret = ? WHERE admin.contact = ?",
              [hashedOTP, secret, mobile]
            );
            smsapi("admin", "otp_send", mobile, otp, `3 min`);
            console.log("OTP send successfully");
            return res.status(200).json({
              status_code: "1",
              status: "success",
              message: "Provide OTP for save devices.",
            });
          }
        } else {
          var wrong_attempts =
            parseInt(savedUser[0].wrong_attempts) + parseInt(1);
          if (wrong_attempts < 3) {
            await connection.query(
              "UPDATE admin SET wrong_attempts = ? WHERE contact = ?",
              [wrong_attempts, mobile]
            );
            var attempts_left = parseInt(3) - parseInt(wrong_attempts);
            return res.status(422).json({
              status_code: "2",
              status: "failed",
              message: `Invalid password, you have ${attempts_left} attempts left`,
            });
          } else if (wrong_attempts === 3) {
            await connection.query(
              "UPDATE admin SET wrong_attempts = ?, status = ? WHERE contact = ?",
              [wrong_attempts, 0, mobile]
            );
            return res.status(422).json({
              status_code: "2",
              status: "failed",
              message: "Your account is blocked now.",
            });
          }
        }
      }
    }
  } catch (err) {
    console.log(err);
    return res
      .status(422)
      .json({ status_code: "2", status: "failed", error: err.message });
  } finally {
    if (connection) {
      await connection.release();
    }
  }
});

router.post("/login-with-otp", async (req, res) => {
  const { mobile, otp, mac_id } = req.body;
  const key = req.headers.key;

  try {
    if (!key) {
      return res.status(422).json({
        status_code: "2",
        status: "failed",
        error: "Please provide API Key",
      });
    } else if (!mac_id) {
      return res.status(422).json({
        status_code: "2",
        status: "failed",
        error: "Please provide MAC ID",
      });
    }

    const saltedOTP = SALT.concat(otp);
    const hashedOTP = md5(saltedOTP);

    // Use promise-based connection
    const connection = await poolPromise().getConnection();

    try {
      // Check secret key
      const [fetchedKey] = await connection.query(
        "SELECT id FROM secret_key WHERE secret_key = ?",
        [key]
      );

      if (fetchedKey.length === 0) {
        return res.status(422).json({
          status_code: "2",
          status: "failed",
          message: "INVALID API KEY",
        });
      }

      // Fetch admin details
      const [admin] = await connection.query(
        "SELECT * FROM admin WHERE contact = ? AND status = ?",
        [mobile, 1]
      );

      if (admin.length === 0) {
        return res.status(422).json({
          status_code: "2",
          status: "failed",
          message: "Invalid mobile number.",
        });
      }

      if (admin[0].admin_otp === hashedOTP) {
        // Update admin details with mac_id and generate token
        const secret = (Math.random() + 1).toString(36).substring(2);
        const token = jwt.sign(
          { unique_id: admin[0].unique_id, secret_key: secret },
          JWT_KEYS
        );

        // Update admin details with mac_id and secret
        await connection.query(
          "UPDATE admin SET mac_id = ?, admin.secret = ? WHERE contact = ?",
          [mac_id, secret, mobile]
        );

        return res.status(200).json({
          status_code: "1",
          status: "success",
          Data: {
            "account id": admin[0].accountid,
            name: admin[0].name,
            role: admin[0].role,
            status: admin[0].status,
            token: token,
          },
        });
      } else {
        return res
          .status(422)
          .json({ status_code: "2", status: "failed", message: "INVALID OTP" });
      }
    } catch (err) {
      console.log(err);
      return res
        .status(422)
        .json({ status_code: "2", status: "failed", error: err.message });
    } finally {
      // Release the connection
      if (connection) {
        await connection.release();
      }
    }
  } catch (err) {
    return res
      .status(422)
      .json({ status_code: "2", status: "failed", error: err.message });
  }
});

router.post("/forget-password", async (req, res) => {
  const key = req.headers.key;
  const { mobile } = req.body;

  try {
    if (!key) {
      return res.status(422).json({
        status_code: "2",
        status: "failed",
        error: "Please provide API Key",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 9000); // Changed OTP digits from 4 to 6.
    const saltedOTP = SALT.concat(otp);
    const hashedOTP = md5(saltedOTP);

    // Use promise-based connection
    const connection = await poolPromise().getConnection();

    try {
      // Check secret key
      const [fetchedKey] = await connection.query(
        "SELECT id FROM secret_key WHERE secret_key = ?",
        [key]
      );

      if (fetchedKey.length === 0) {
        return res.status(422).json({
          status_code: "2",
          status: "failed",
          message: "INVALID API KEY",
        });
      }

      // Fetch admin details
      const [admin] = await connection.query(
        "SELECT id, status FROM admin WHERE contact = ?",
        [mobile]
      );

      if (admin.length === 0) {
        return res.status(422).json({
          status_code: "2",
          status: "failed",
          message: "Invalid Mobile number",
        });
      }

      if (admin[0].status === 0) {
        return res.status(422).json({
          status_code: "2",
          status: "failed",
          message: "Your Account is blocked.",
        });
      }

      // Update admin details with hashed OTP
      await connection.query(
        "UPDATE admin SET admin_otp = ? WHERE contact = ?",
        [hashedOTP, mobile]
      );

      // Send OTP
      smsapi("admin", "otp_send", mobile, otp, `3 min`);
      console.log("OTP sent successfully");

      return res.status(200).json({
        status_code: "1",
        status: "success",
        message: "Provide OTP for reset password.",
      });
    } catch (err) {
      console.error(err);
      return res
        .status(422)
        .json({ status_code: "2", status: "failed", error: err.message });
    } finally {
      // Release the connection
      if (connection) {
        await connection.release();
      }
    }
  } catch (err) {
    return res
      .status(422)
      .json({ status_code: "2", status: "failed", error: err.message });
  }
});

router.post("/reset-password", async (req, res) => {
  const key = req.headers.key;
  const { mobile, otp, new_password } = req.body;

  // Check for MD5 hash characteristics
  if (new_password.length !== 32 || !/^[a-f0-9]{32}$/.test(new_password)) {
    return res
      .status(422)
      .json({ status_code: "2", status: "failed", message: "Invalid password." });
  }

  try {
    // Use promise-based connection
    const connection = await poolPromise().getConnection();

    try {
      // Check secret key
      const [fetchedKey] = await connection.query(
        "SELECT id FROM secret_key WHERE secret_key = ?",
        [key]
      );

      if (fetchedKey.length === 0) {
        return res.status(422).json({
          status_code: "2",
          status: "failed",
          message: "INVALID API KEY",
        });
      }

      // Fetch admin details
      const [admin] = await connection.query(
        "SELECT * FROM admin WHERE contact = ?",
        [mobile]
      );

      if (admin.length === 0) {
        return res.status(422).json({
          status_code: "2",
          status: "failed",
          message: "Invalid mobile number.",
        });
      }

      const savedUseraccount_id = admin[0].accountid;
      const savedUsername = admin[0].name;
      const savedUserrole = admin[0].role;
      const savedUserstatus = admin[0].status;

      if (admin[0].status === 0) {
        return res.status(422).json({
          status_code: "2",
          status: "failed",
          message: "Your account is blocked.",
        });
      }

      const saltedOTP = SALT.concat(otp);
      const hashedOTP = md5(saltedOTP);

      if (admin[0].admin_otp === hashedOTP) {
        // Update admin password
        await connection.query(
          "UPDATE admin SET password = ? WHERE contact = ?",
          [new_password, mobile]
        );

        // Generate token
        const secret = (Math.random() + 1).toString(36).substring(2);
        const token = jwt.sign(
          { unique_id: admin[0].unique_id, secret_key: secret },
          JWT_KEYS
        );

        // Update admin secret
        await connection.query(
          "UPDATE admin SET admin.secret = ? WHERE admin.contact = ?",
          [secret, mobile]
        );

        // Added .status(200)
        return res.status(200).json({
          status_code: "1",
          status: "success",
          Data: {
            "account id": savedUseraccount_id,
            name: savedUsername,
            role: savedUserrole,
            status: savedUserstatus,
            token: token,
          },
        });
      } else {
        return res
          .status(422)
          .json({ status_code: "2", status: "failed", message: "Invalid OTP." });
      }
    } catch (err) {
      console.error(err);
      return res
        .status(422)
        .json({ status_code: "2", status: "failed", error: err.message });
    } finally {
      // Release the connection
      if (connection) {
        await connection.release();
      }
    }
  } catch (err) {
    return res
      .status(422)
      .json({ status_code: "2", status: "failed", error: err.message });
  }
});

/// Auth Admin end

//Employee Login & Update KYC start

router.post("/employee-login", async (req, res) => {
  // Get a connection from the pool
  const connection = await poolPromise().getConnection();
 
  try {
    
    // Validate API key
    const key = req.headers.key;

    if (!key) {
      return res.status(401).json({
        status_code: "2",
        status: "failed",
        message: "API key required",
      });
    }

    const sqlCheckKey = "SELECT id FROM secret_key WHERE secret_key = ?";
    const valueCheckKey = [key];

    const [fetchedKey] = await connection.query(sqlCheckKey, valueCheckKey);

    if (fetchedKey.length === 0) {
      return res.status(422).json({
        status_code: "2",
        status: "failed",
        message: "Invalid API key",
      });
    }

    // Get request body
    const { mobile, deviceId, coordinates, ip, os } = req.body;

    // Query staff data
    const sqlQueryStaff = "SELECT * FROM staff_data WHERE mobile = ?";
    const valuesQueryStaff = [mobile];

    const [staff] = await connection.query(sqlQueryStaff, valuesQueryStaff);
    console.log(staff[0]);
    if (!staff || staff.length === 0) {
      return res.status(404).json({
        status_code: "2",
        status: "failed",
        message: "User data not found",
      });
    }

    const status = staff[0].status;
    const application_id = staff[0].application_id;

    switch (status) {
      case "8":
        return res.status(200).json({
          status_code: "05",
          status: "pending",
          application_id,
          message: "Set new password",
        });
      case "7":
        const [tnc] = await connection.query(
          'SELECT terms_and_conditions FROM tnc_tab WHERE designation_id = ? AND status = "Enable"',
          [staff[0].designation_id]
        );

        if (tnc.length === 0) {
          return res.status(404).json({
            status_code: "2",
            status: "failed",
            message: "Terms and conditions not found for the designation",
          });
        }

        return res.status(200).json({
          status_code: "06",
          status: "success",
          application_id: staff[0].application_id,
          terms_conditions: String(tnc[0].terms_and_conditions)
            .replace(
              /\(date\)/g,
              moment.utc(new Date()).local().format("DD-MM-YYYY HH:mm:ss")
            )
            .replace(/\(Employee_name\)/g, staff[0].name),
        // });
          // status_code: "06",
          // status: "success",
          // application_id,
          // message: "Terms and conditions accepted is pending",
        });

      case "6":
        return res.status(200).json({
          status_code: "07",
          status: "success",
          application_id,
          message: "Update profile is pending",
        });
      case "5":
        return res.status(200).json({
          status_code: "08",
          status: "success",
          application_id,
          message: "Update personal document",
        });
      case "4":
        return res.status(200).json({
          status_code: "09",
          status: "success",
          application_id,
          message: "Education details update pending",
        });
      case "3":
        return res.status(200).json({
          status_code: "10",
          status: "success",
          application_id,
          message: "Working experience update is pending",
        });
      case "2":
        return res.status(200).json({
          status_code: "2",
          status: "pending",
          message: "Your account is pending for approval",
        });
      case "1":
        if (staff[0].password === "e10adc3949ba59abbe56e057f20f883e") {
          return res.status(200).json({
            status_code: "5",
            status: "success",
            message: "Set password",
          });
        } else if (deviceId === staff[0].device_Id) {
          // Generate token
          const secret = (Math.random() + 1).toString(36).substring(2);
          const token = jwt.sign(
            { unique_id: staff[0].unique_id, secret_key: secret },
            JWT_KEYS
          );
 
          // Update OS, coordinates, and IP
          const sqlUpdateStaff =
            "UPDATE staff_data SET os = ?, coordinates = ?, ip = ?, secret = ? WHERE id = ?";
          const valuesUpdateStaff = [os, coordinates, ip, secret, staff[0].id];

          const [updatedStaff] = await connection.query(
            sqlUpdateStaff,
            valuesUpdateStaff
          );

          if (updatedStaff.affectedRows >= 1) {
            return res.status(200).json({
              status_code: "1",
              status: "success",
              data: {
                employee_id: staff[0].emp_id,
                name: staff[0].name,
                department: staff[0].department,
                designation: staff[0].designation,
                office_mobile: staff[0].office_mobile,
                office_email: staff[0].office_email,
                profile_photo: staff[0].profile_photo,
                token,
              },
            });
          }
        } else {
          return res.status(200).json({
            status_code: "02",
            status: "login_with_password",
            message: "Login with password",
          });
        }
      case "0":
        return res.status(200).json({
          status_code: "2",
          status: "suspended",
          message: "Your account is suspended",
        });
      default:
        return res.status(500).json({
          status_code: "2",
          status: "failed",
          message: "Internal server error",
        });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Something went wrong",
    });
  } finally {
    // Release the connection back to the pool
    await connection.release();
  }
});

router.post("/employee-login-password", async (req, res) => {
  // Get a connection from the pool
  const connection = await poolPromise().getConnection();

  try {
    // Validate API key
    const key = req.headers.key;

    if (!key) {
      return res.status(401).json({
        status_code: "2",
        status: "failed",
        message: "API key required",
      });
    }

    const sqlCheckKey = "SELECT id FROM secret_key WHERE secret_key = ?";
    const valueCheckKey = [key];

    const [fetchedKey] = await connection.query(sqlCheckKey, valueCheckKey);

    if (fetchedKey.length === 0) {
      return res.status(422).json({
        status_code: "2",
        status: "failed",
        message: "Invalid API key",
      });
    }

    // Get request body data
    const { mobile, deviceId, coordinates, ip, os, password } = req.body;

    // Query staff data
    const sqlQueryStaff = "SELECT * FROM staff_data WHERE mobile = ?";
    const valuesQueryStaff = [mobile];

    const [staff] = await connection.query(sqlQueryStaff, valuesQueryStaff);

    if (!staff || staff.length === 0) {
      return res.status(404).json({
        status_code: "2",
        status: "failed",
        message: "User data not found",
      });
    }

    // Validate password using a secure hashing algorithm
    if (password !== staff[0].password) {
      return res.status(401).json({
        status_code: "2",
        status: "failed",
        message: "Invalid password",
      });
    }

    // Generate token
    const secret = (Math.random() + 1).toString(36).substring(2);
    const token = jwt.sign(
      { unique_id: staff[0].unique_id, secret_key: secret },
      JWT_KEYS
    );

    // Update device ID, OS, coordinates, and IP
    const sqlUpdateStaff =
      "UPDATE staff_data SET device_Id = ?, os = ?, coordinates = ?, ip = ?, secret = ? WHERE id = ?";
    const valuesUpdateStaff = [
      deviceId,
      os,
      coordinates,
      ip,
      secret,
      staff[0].id,
    ];

    const [updatedStaff] = await connection.query(
      sqlUpdateStaff,
      valuesUpdateStaff
    );

    if (updatedStaff.affectedRows >= 1) {
      return res.status(200).json({
        status_code: "1",
        status: "success",
        data: {
          employee_id: staff[0].emp_id,
          name: staff[0].name,
          department: staff[0].department,
          designation: staff[0].designation,
          profile_photo: staff[0].profile_photo,
          token,
        },
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Something went wrong",
    });
  } finally {
    // Release the connection back to the pool
    await connection.release();
  }
});

router.post("/employee-forgot-password", async (req, res) => {
  // Get a connection from the pool
  const connection = await poolPromise().getConnection();

  try {
    // Validate API key
    const key = req.headers.key;

    if (!key) {
      return res.status(401).json({
        status_code: "2",
        status: "failed",
        message: "API key required",
      });
    }

    const sqlCheckKey = "SELECT id FROM secret_key WHERE secret_key = ?";
    const valueCheckKey = [key];

    const [fetchedKey] = await connection.query(sqlCheckKey, valueCheckKey);

    if (fetchedKey.length === 0) {
      return res.status(422).json({
        status_code: "2",
        status: "failed",
        message: "Invalid API key",
      });
    }

    // Get request body data
    const { mobile, coordinates, os } = req.body;

    // Query staff data
    const sqlQueryStaff = "SELECT * FROM staff_data WHERE mobile = ?";
    const valuesQueryStaff = [mobile];

    const [staff] = await connection.query(sqlQueryStaff, valuesQueryStaff);

    if (!staff || staff.length === 0) {
      return res.status(404).json({
        status_code: "2",
        status: "failed",
        message: "User data not found",
      });
    }

    // Generate a random OTP and send it to staff's registered mobile number
    const otp = Math.floor(100000 + Math.random() * 900000);
    const saltedOTP = SALT.concat(otp);
    const hashedOTP = md5(saltedOTP);

    await smsapi("admin", "otp_send", mobile, otp, "3 min");

    // Store OTP in the database
    const sqlUpdateStaff =
      "UPDATE staff_data SET otp = ?, coordinates = ?, os = ? WHERE id = ?";
    const valuesUpdateStaff = [hashedOTP, coordinates, os, staff[0].id];

    const [updatedStaff] = await connection.query(
      sqlUpdateStaff,
      valuesUpdateStaff
    );

    if (updatedStaff.affectedRows >= 1) {
      return res.status(200).json({
        status_code: "4",
        status: "success",
        message: "OTP successfully sent",
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Something went wrong",
    });
  } finally {
    // Release the connection back to the pool
    await connection.release();
  }
});

router.post("/employee-reset-password", async (req, res) => {
  // Get a connection from the pool
  const connection = await poolPromise().getConnection();

  try {
    // Validate API key
    const key = req.headers.key;

    if (!key) {
      return res.status(401).json({
        status_code: "2",
        status: "failed",
        message: "API key required",
      });
    }

    const sqlCheckKey = "SELECT id FROM secret_key WHERE secret_key = ?";
    const valueCheckKey = [key];

    const [fetchedKey] = await connection.query(sqlCheckKey, valueCheckKey);

    if (fetchedKey.length === 0) {
      return res.status(422).json({
        status_code: "2",
        status: "failed",
        message: "Invalid API key",
      });
    }

    // Get request body data
    const { mobile, deviceId, coordinates, ip, os, otp, newPassword } =
      req.body;

    // Check for MD5 hash characteristics:
    if (newPassword.length !== 32 || !/^[a-f0-9]{32}$/.test(newPassword)) {
      return res.status(422).json({
        status_code: "2",
        status: "failed",
        message: "Invalid password.",
      });
    }

    // Query staff data
    const sqlQueryStaff = "SELECT * FROM staff_data WHERE mobile = ?";
    const valuesQueryStaff = [mobile];

    const [staff] = await connection.query(sqlQueryStaff, valuesQueryStaff);

    if (!staff || staff.length === 0) {
      return res.status(404).json({
        status_code: "2",
        status: "failed",
        message: "User data not found",
      });
    }

    // Validate OTP
    const saltedOTP = SALT.concat(otp);
    const hashedOTP = md5(saltedOTP);

    if (staff[0].otp !== hashedOTP) {
      return res.status(400).json({
        status_code: "2",
        status: "failed",
        message: "Invalid OTP",
      });
    }

    // Generate token
    const secret = (Math.random() + 1).toString(36).substring(2);
    const token = jwt.sign(
      { unique_id: staff[0].unique_id, secret_key: secret },
      JWT_KEYS
    );

    // Update data in the database
    const sqlUpdateStaff =
      "UPDATE staff_data SET password = ?, device_Id = ?, os = ?, coordinates = ?, ip = ?, secret = ?  WHERE id = ?";
    const valuesUpdateStaff = [
      newPassword,
      deviceId,
      os,
      coordinates,
      ip,
      secret,
      staff[0].id,
    ];

    const [updatedStaff] = await connection.query(
      sqlUpdateStaff,
      valuesUpdateStaff
    );

    if (updatedStaff.affectedRows >= 1) {
      return res.status(200).json({
        status_code: "1",
        status: "success",
        data: {
          employee_id: staff[0].emp_id,
          name: staff[0].name,
          department: staff[0].department,
          designation: staff[0].designation,
          profile_photo: staff[0].profile_photo,
          token,
        },
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Something went wrong",
    });
  } finally {
    // Release the connection back to the pool
    await connection.release();
  }
});

router.post("/crm-set-password", async (req, res) => {
  // Get a connection from the pool
  const connection = await poolPromise().getConnection();

  try {
    // Validate API key
    const key = req.headers.key;

    if (!key) {
      return res.status(401).json({
        status_code: "2",
        status: "failed",
        message: "API key required",
      });
    }

    const sqlCheckKey = "SELECT id FROM secret_key WHERE secret_key = ?";
    const valueCheckKey = [key];

    const [fetchedKey] = await connection.query(sqlCheckKey, valueCheckKey);

    if (fetchedKey.length === 0) {
      return res.status(422).json({
        status_code: "2",
        status: "failed",
        message: "Invalid API key",
      });
    }

    // Get request body data
    const { mobile, deviceId, coordinates, ip, os, oldPassword, newPassword } =
      req.body;

    // Check for MD5 hash characteristics:
    if (newPassword.length !== 32 || !/^[a-f0-9]{32}$/.test(newPassword)) {
      return res.status(422).json({
        status_code: "2",
        status: "failed",
        message: "Invalid new password.",
      });
    }

    // Check for MD5 hash characteristics:
    if (oldPassword.length !== 32 || !/^[a-f0-9]{32}$/.test(oldPassword)) {
      return res.status(422).json({
        status_code: "2",
        status: "failed",
        message: "Invalid old password.",
      });
    }

    // Query staff data
    const sqlQueryStaff = "SELECT * FROM staff_data WHERE mobile = ?";
    const valuesQueryStaff = [mobile];

    const [staff] = await connection.query(sqlQueryStaff, valuesQueryStaff);

    if (!staff || staff.length === 0) {
      return res.status(404).json({
        status_code: "2",
        status: "failed",
        message: "User data not found",
      });
    }

    if (String(oldPassword) !== String(staff[0].password)) {
      return res.status(401).json({
        status_code: "2",
        status: "failed",
        message: "Invalid old password",
      });
    }

    // Update data in the database
    const sqlUpdateStaff =
      "UPDATE staff_data SET password = ?, device_Id = ?, os = ?, coordinates = ?, ip = ?,  `status` = ? WHERE id = ?";
    const valuesUpdateStaff = [
      newPassword,
      deviceId,
      os,
      coordinates,
      ip,
      "7",
      staff[0].id,
    ];

    const [updatedStaff] = await connection.query(
      sqlUpdateStaff,
      valuesUpdateStaff
    );

    // Fetch terms and conditions based on designation ID and status
    const [designation] = await connection.query(
      'SELECT designation_id  FROM designation WHERE designation = ? AND status = "Enable"',
      [staff[0].designation]
    );
    const [tnc] = await connection.query(
      'SELECT terms_and_conditions FROM tnc_tab WHERE designation_id = ? AND status = "Enable"',
      [designation[0].designation_id]
    );

    if (tnc.length === 0) {
      return res.status(404).json({
        status_code: "2",
        status: "failed",
        message: "Terms and conditions not found for the designation",
      });
    }

    if (updatedStaff.affectedRows >= 1) {
      return res.status(200).json({
        status_code: "06",
        status: "success",
        application_id: staff[0].application_id,
        terms_conditions: String(tnc[0].terms_and_conditions)
          .replace(
            /\(date\)/g,
            moment.utc(new Date()).local().format("DD-MM-YYYY HH:mm:ss")
          )
          .replace(/\(Employee_name\)/g, staff[0].name),
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Something went wrong",
    });
  } finally {
    // Release the connection back to the pool
    await connection.release();
  }
});

// pending name accepted-tandc // signature size changed in db 22 to 128 varcher
router.post("/crm-accepted-tandc", upload.fields([{ name: "signature", maxCount: 1 }]),
  async (req, res) => {
    // Get a connection from the pool
    const connection = await poolPromise().getConnection();

    try {
      // Get form data

      if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).send({ statuscode : 2, status: 'failed', message: 'please upload atleast one signature'});
    }

      const signature = req.files["signature"]
        ? req.files["signature"][0]
        : null;
      let { tnc, application_id } = req.body;

      const [staff_data] = await connection.query(
        "SELECT * FROM staff_data WHERE application_id = ?",
        [application_id]
      );
      if (staff_data.length === 0) {
        return res.status(400).json({
          status_code: "2",
          status: "failed",
          message: "Staff not found.",
        });
      }

      const unique_id = staff_data[0].unique_id;

      // Validate T&C acceptance
      if (tnc && tnc.toLowerCase() === "accepted") {
        // Update staff status code in staff_data table
        const [staffUpdate] = await connection.query(
          'UPDATE staff_data SET status = "6" WHERE unique_id = ?',
          [unique_id]
        );

        if (staffUpdate.affectedRows === 0) {
          return res.status(400).json({
            status_code: "2",
            status: "failed",
            message: "Staff not found.",
          });
        }
      } else {
        tnc = "Not-Accepted";
      }

      if (!signature) {
        return res.status(400).json({
          status_code: "2",
          status: "failed",
          message: "Signature required",
        });
      }

      // Update signature and T&C status in profile table
      const [profileUpdate] = await connection.query(
        "UPDATE emp_profile SET signature = ?, tnc = ? WHERE unique_id = ?",
        [signature.filename, tnc, unique_id]
      );

      if (profileUpdate.affectedRows === 0) {
        const [profileInsert] = await connection.query(
          "INSERT INTO emp_profile (signature, tnc, unique_id) VALUES (?, ?, ?)",
          [signature.filename, tnc, unique_id]
        );

        if (profileInsert.affectedRows > 0) {
          return res.status(200).json({
            status_code: "07",
            status: "success",
            application_id,
            message: "Update profile",
          });
        }
      } else {
        return res.status(200).json({
          status_code: "07",
          status: "success",
          application_id,
          message: "Update profile",
        });
      }
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        status_code: "2",
        status: "failed",
        message: "Something went wrong",
      });
    } finally {
      // Release the connection back to the pool
      await connection.release();
    }
  }
);

router.post("/crm-update-profile", async (req, res) => {
  // Get a connection from the pool
  const connection = await poolPromise().getConnection();

  try {
    // Get form data
    const {
      application_id,
      full_name,
      email,
      gorgon_name,
      gender,
      marital_status,
      date_of_birth,
      nationality,
      pan_number,
      aadhaar_number,
      address,
    } = req.body;

    const [staff_data] = await connection.query(
      "SELECT * FROM staff_data WHERE application_id = ?",
      [application_id]
    );
    if (staff_data.length === 0) {
      return res.status(400).json({
        status_code: "2",
        status: "failed",
        message: "Staff not found.",
      });
    }

    const unique_id = staff_data[0].unique_id;

    // Check if the profile exists
    const [existingProfile] = await connection.query(
      "SELECT * FROM emp_profile WHERE unique_id = ?",
      [unique_id]
    );

    if (existingProfile.length === 0) {
      return res.status(400).json({
        status_code: "2",
        status: "failed",
        message: "Profile not found.",
      });
    }

    // Update profile in the database
    const [profileUpdate] = await connection.query(
      "UPDATE emp_profile SET gorgon_name = ?, gender = ?, marital_status = ?, date_of_birth = ?, nationality = ?, pan_number = ?, aadhaar_number = ?, address = ? WHERE unique_id = ?",
      [
        gorgon_name,
        gender,
        marital_status,
        date_of_birth,
        nationality,
        pan_number,
        aadhaar_number,
        JSON.stringify(address), // Assuming address is a JSON string
        unique_id,
      ]
    );

    if (profileUpdate.affectedRows === 0) {
      return res.status(500).json({
        status_code: "2",
        status: "failed",
        message: "Profile update failed.",
      });
    }

    // Update status code in staff_data table
    const [staffUpdate] = await connection.query(
      'UPDATE staff_data SET status = "5",name = ?, email = ? WHERE unique_id = ?',
      [full_name, email, unique_id]
    );

    if (staffUpdate.affectedRows === 0) {
      return res.status(500).json({
        status_code: "2",
        status: "failed",
        message: "Staff data update failed.",
      });
    }

    return res.status(200).json({
      status_code: "08",
      status: "success",
      application_id,
      message: "update Your Personal Profile.",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Something went wrong",
    });
  } finally {
    // Release the connection back to the pool
    await connection.release();
  }
});

router.post("/crm-update-document", upload.fields([
    { name: "aadhaar_front" , maxCount: 1},
    { name: "aadhaar_back", maxCount: 1 },
    { name: "pan_front" , maxCount: 1},
    { name: "cv", maxCount: 1 },
    { name: "photo", maxCount: 1 },
  ]),
  async (req, res) => {
    const requiredFields = [
      "aadhaar_front",
      "aadhaar_back",
      "pan_front",
      "cv",
      "photo",
    ];
    for (const field of requiredFields) {
      if (!req.files[field] || req.files[field].length === 0) {
        return res.status(400).json({
          status_code: "2",
          status: "failed",
          message: `${field} file is required.`,
        });
      }
    }
    // Get a connection from the pool
    const connection = await poolPromise().getConnection();

    try {
      var { application_id } = req.body;
      console.log(req.files);
      const [staff_data] = await connection.query(
        "SELECT * FROM staff_data WHERE application_id = ?",
        [application_id]
      );
      if (staff_data.length === 0) {
        return res.status(400).json({
          status_code: "2",
          status: "failed",
          message: "Staff not found.",
        });
      }

      const unique_id = staff_data[0].unique_id;

      // Check if the profile exists
      const [existingProfile] = await connection.query(
        " SELECT * FROM emp_profile WHERE unique_id = ? ",
        [unique_id]
      );

      if (existingProfile.length === 0) {
        return res.status(400).json({
          status_code: "2",
          status: "failed",
          message: "Profile not found.",
        });
      }

      // Update documents in the database
      const [profileUpdate] = await connection.query(
        "UPDATE emp_profile SET aadhaar_front = ?, aadhaar_back = ?, pan_front = ?, cv = ?, photo = ? WHERE unique_id = ?",
        [
          req.files.aadhaar_front ? req.files.aadhaar_front[0].filename : null,
          req.files.aadhaar_back ? req.files.aadhaar_back[0].filename : null,
          req.files.pan_front ? req.files.pan_front[0].filename : null,
          req.files.cv ? req.files.cv[0].filename : null,
          req.files.photo ? req.files.photo[0].filename : null,
          unique_id,
        ]
      );

      if (profileUpdate.affectedRows === 0) {
        return res.status(500).json({
          status_code: "2",
          status: "failed",
          message: "Document update failed.",
        });
      }

      // Update status code in staff_data table
      const [staffUpdate] = await connection.query(
        'UPDATE staff_data SET status = "4" WHERE unique_id = ?',
        [unique_id]
      );

      if (staffUpdate.affectedRows === 0) {
        return res.status(500).json({
          status_code: "2",
          status: "failed",
          message: "Staff data update failed.",
        });
      }

      return res.status(200).json({
        status_code: "09",
        application_id,
        status: "success",
        message: "Update Education Details",
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        status_code: "2",
        status: "failed",
        message: "Something went wrong",
      });
    } finally {
      // Release the connection back to the pool
      await connection.release();
    }
  }
);

router.post("/crm-add-education", async (req, res) => {
  // Get a connection from the pool
  const connection = await poolPromise().getConnection();

  try {
    // Get education data from the request body
    const { educationData, application_id } = req.body;
    console.log(educationData);

    const [staff_data] = await connection.query(
      "SELECT * FROM staff_data WHERE application_id = ?",
      [application_id]
    );
    if (staff_data.length === 0) {
      return res.status(400).json({
        status_code: "2",
        status: "failed",
        message: "Staff not found.",
      });
    }

    const unique_id = staff_data[0].unique_id;

    // Insert education records into the database
    const educationValues = educationData.map(
      ({ degree, school, board, year, division, percentage }) => [
        unique_id,
        degree,
        school,
        board,
        year,
        division,
        percentage,
      ]
    );

    // Execute the query to insert education records
    const [educationInsert] = await connection.query(
      "INSERT INTO education (unique_id, degree, school, board, year, division, percentage) VALUES ?",
      [educationValues]
    );

    if (educationInsert.affectedRows === 0) {
      return res.status(500).json({
        status_code: "2",
        status: "failed",
        message: "Failed to add education details.",
      });
    }

    // Update status code in staff_data table
    const [staffUpdate] = await connection.query(
      'UPDATE staff_data SET status = "3" WHERE application_id = ?',
      [application_id]
    );

    if (staffUpdate.affectedRows === 0) {
      return res.status(500).json({
        status_code: "2",
        status: "failed",
        message: "Failed to update staff status.",
      });
    }

    return res.status(200).json({
      status_code: "10",
      status: "success",
      application_id,
      message: "Update Experience Details",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Something went wrong",
    });
  } finally {
    // Release the connection back to the pool
    await connection.release();
  }
});

//doubt "Field 'ccc' doesn't have a default value"
router.post("/crm-add-experience", async (req, res) => {
  // Get a connection from the pool
  const connection = await poolPromise().getConnection();

  try {
    // Get experience data from the request body
    const { experienceData, application_id } = req.body;

    const [staff_data] = await connection.query(
      "SELECT * FROM staff_data WHERE application_id = ?",
      [application_id]
    );
    if (staff_data.length === 0) {
      return res.status(400).json({
        status_code: "2",
        status: "failed",
        message: "Staff not found.",
      });
    }

    const unique_id = staff_data[0].unique_id;

    // Insert experience records into the database
    const experienceValues = experienceData.map(
      ({ title, companyName, startDate, endDate }) => [
        title,
        companyName,
        startDate,
        endDate,
        unique_id,
      ]
    );

    await connection.query(
      "INSERT INTO working_experience (title, company_name, start_date, end_date, unique_id) VALUES ?",
      [experienceValues]
    );

    // Update status code in staff_data table
    const [staffUpdate] = await connection.query(
      'UPDATE staff_data SET status = "2" WHERE unique_id = ?',
      [unique_id]
    );

    if (staffUpdate.affectedRows === 0) {
      return res.status(500).json({
        status_code: "2",
        status: "failed",
        message: "Failed to update staff status.",
      });
    }

    return res.status(200).json({
      status_code: "1",
      status: "success",
      message: "Your account is Pending for Approval ",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Something went wrong",
    });
  } finally {
    // Release the connection back to the pool
    await connection.release();
  }
});

//Employee Login & Update KYC end

//Distributor Login API start

router.post("/distributor-login", async (req, res) => {
  const connection = await poolPromise().getConnection();

  try {
    const { mobile, mac_id, os, coordinates, ip } = req.body;

    // Validate API key
    const key = req.headers.key;

    if (!key) {
      return res.status(401).json({
        status_code: "2",
        status: "failed",
        message: "API key required",
      });
    }

    const sqlCheckKey = "SELECT id FROM secret_key WHERE secret_key = ?";
    const valueCheckKey = [key];

    const [fetchedKey] = await connection.query(sqlCheckKey, valueCheckKey);

    if (fetchedKey.length === 0) {
      return res.status(422).json({
        status_code: "2",
        status: "failed",
        message: "Invalid API key",
      });
    }

    const [userData] = await connection.query(
      "SELECT * FROM login WHERE user_type = ? AND mobile_number = ?",
      ["Distributor", mobile]
    );

    console.log(userData);

    if (!userData || userData.length === 0) {
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message: "Unauthorized Access",
      });
    }

    const status = userData[0].status;

    const statusMessages = {
      6: "Mobile Number Verification Pending",
      5: "Onboard Is Pending",
      4: "KYC Onboard Pending",
      3: "Territory Assign is Pending",
      2: "KYC Verification Pending",
      1: "Active",
      0: "Suspended",
    };

    const getStatusMessage = (statusCode) =>
      statusMessages[statusCode] || "Unknown Status";

    switch (status) {
      case "6":
      case "5":
      case "4":
      case "3":
        return res.status(200).json({
          status_code: "2",
          status: "failed",
          message: `${getStatusMessage(
            status
          )}. Please contact ASM or Support Desk.`,
        });
      case "0":
        return res.status(200).json({
          status_code: "2",
          status: "suspended",
          message: "Your Account is Suspended. Contact ASM.",
        });
      case "2":
      case "1":
        if (
          !userData[0].password &&
          (!mac_id || mac_id !== userData[0].mac_id)
        ) {
          const otp = Math.floor(100000 + Math.random() * 900000);
          const saltedOTP = SALT.concat(otp);
          const hashedOTP = md5(saltedOTP);
          await smsapi("admin", "otp_send", mobile, otp, "3 min");

          await connection.query(
            "UPDATE login SET otp = ?, coordinates = ?, os = ?, ip = ? WHERE id = ?",
            [hashedOTP, coordinates, os, ip, userData[0].id]
          );

          return res.status(200).json({
            status_code: "02",
            status: "send_otp",
            message: "OTP Successfully Sent to Registered Mobile",
          });
        } else if (
          mac_id &&
          mac_id !== userData[0].mac_id &&
          userData[0].password
        ) {
          return res.status(200).json({
            status_code: "03",
            status: "pending",
            message: "Unlock with password and save device details",
          });
        } else if (
          !userData[0].password &&
          mac_id &&
          mac_id === userData[0].mac_id
        ) {
          const setPwdToken = jwt.sign(
            { unique_id: userData[0].unique_id },
            JWT_KEYS,
            { expiresIn: "10m" } // Token valid for 10 minutes
          );
          return res.status(200).json({
            status_code: "04",
            status: "set_password",
            token: setPwdToken,
            message: "Set Password",
          });
        } else if (
          mac_id &&
          mac_id === userData[0].mac_id &&
          userData[0].password
        ) {
          const secret = (Math.random() + 1).toString(36).substring(2);
          const token = jwt.sign(
            { unique_id: userData[0].unique_id, secret_key: secret },
            JWT_KEYS
          );

          await connection.query(
            "UPDATE login SET coordinates = ?, os = ?, ip = ?, `key` = ? WHERE id = ?",
            [coordinates, os, ip, secret, userData[0].id]
          );
          return res.status(200).json({
            status_code: "01",
            status: getStatusMessage(status),
            name: userData[0].name,
            mobile: userData[0].mobile_number,
            pin_status:
              userData[0].pin === null || !userData[0].pin
                ? "Not available"
                : "Available",
            customer_id: userData[0].customer_id,
            token,
          });
        }
      default:
        return res.status(404).json({
          status_code: "2",
          status: "failed",
          message: "Internal Server Error",
        });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Internal Server Error",
    });
  } finally {
    await connection.release();
  }
});

router.post("/distributor-login-with-otp", async (req, res) => {
  const connection = await poolPromise().getConnection();

  try {
    const { otp, mobile, coordinates, mac_id, os } = req.body;

    // Validate API key
    const key = req.headers.key;

    if (!key) {
      return res.status(401).json({
        status_code: "2",
        status: "failed",
        message: "API key required",
      });
    }

    const sqlCheckKey = "SELECT id FROM secret_key WHERE secret_key = ?";
    const valueCheckKey = [key];

    const [fetchedKey] = await connection.query(sqlCheckKey, valueCheckKey);

    if (fetchedKey.length === 0) {
      return res.status(422).json({
        status_code: "2",
        status: "failed",
        message: "Invalid API key",
      });
    }
    const saltedOTP = SALT.concat(otp);
    const hashedOTP = md5(saltedOTP);

    // Check if OTP is valid
    const [userData] = await connection.query(
      "SELECT * FROM login WHERE mobile_number = ? AND otp = ?",
      [mobile, hashedOTP]
    );
    console.log(hashedOTP);

    if (userData.length === 0) {
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message: "Invalid OTP.",
      });
    }

    if (!userData[0].password) {
      // Generate token for set password
      const secret = (Math.random() + 1).toString(36).substring(2);
      const setPwdToken = jwt.sign(
        { unique_id: userData[0].unique_id, secret_key: secret },
        JWT_KEYS,
        { expiresIn: "10m" } // Token valid for 10 minutes
      );

      // Update user details
      await connection.query(
        "UPDATE login SET coordinates = ?, mac_id = ?, os = ? WHERE mobile_number = ?",
        [coordinates, mac_id, os, mobile]
      );

      return res.status(200).json({
        status_code: "04",
        status: "set_password",
        message: "Set password",
        token: setPwdToken,
      });
    } else {
      const secret = (Math.random() + 1).toString(36).substring(2);
      const loginToken = jwt.sign(
        { unique_id: userData[0].unique_id, secret_key: secret },
        JWT_KEYS
      );

      await connection.query(
        "UPDATE login SET coordinates = ?, mac_id = ?, os = ?, `key` = ? WHERE mobile_number = ?",
        [coordinates, mac_id, os, secret, mobile]
      );

      const statusMessages = {
        6: "Mobile Number Verification Pending",
        5: "Onboard Is Pending",
        4: "KYC Onboard Pending",
        3: "Territory Assign is Pending",
        2: "KYC Verification Pending",
        1: "Active",
        0: "Suspended",
      };

      return res.status(200).json({
        status_code: "01",
        status: statusMessages[userData[0].status],
        name: userData[0].name,
        mobile: userData[0].mobile_number,
        pin_status:
          userData[0].pin === null || !userData[0].pin
            ? "Not available"
            : "Available",
        customer_id: userData[0].customer_id,
        token: loginToken,
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Internal Server Error",
    });
  } finally {
    await connection.release();
  }
});

router.post("/distributor-login-with-password", async (req, res) => {
  const connection = await poolPromise().getConnection();

  try {
    const { mobile, password, coordinates } = req.body;

    // Validate API key
    const key = req.headers.key;

    if (!key) {
      return res.status(401).json({
        status_code: "2",
        status: "failed",
        message: "API key required",
      });
    }

    const sqlCheckKey = "SELECT id FROM secret_key WHERE secret_key = ?";
    const valueCheckKey = [key];

    const [fetchedKey] = await connection.query(sqlCheckKey, valueCheckKey);

    if (fetchedKey.length === 0) {
      return res.status(422).json({
        status_code: "2",
        status: "failed",
        message: "Invalid API key",
      });
    }

    // Validate MD5 password
    if (password.length !== 32 || !/^[a-f0-9]{32}$/.test(password)) {
      return res.status(422).json({
        status_code: "2",
        status: "failed",
        message: "Invalid password.",
      });
    }

    // Check if user exists
    const userData = await connection.query(
      "SELECT * FROM login WHERE mobile_number = ? AND password = ?",
      [mobile, password]
    );

    if (!userData || userData.length === 0) {
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message: "Invalid password",
      });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000);
    const saltedOTP = SALT.concat(otp);
    const hashedOTP = md5(saltedOTP);
    await smsapi("admin", "otp_send", mobile, otp, "3 min");
    // Update user details
    await connection.query(
      "UPDATE login SET coordinates = ?, otp = ? WHERE mobile_number = ?",
      [coordinates, hashedOTP, mobile]
    );

    return res.status(200).json({
      status_code: "02",
      status: "save_details",
      message: "Details saved. OTP sent to registered mobile.",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Internal Server Error",
    });
  } finally {
    await connection.release();
  }
});

router.post("/distributor-set-password", async (req, res) => {
  const connection = await poolPromise().getConnection();

  try {
    const { password, cpassword, coordinates } = req.body;

    // Validate API key
    const key = req.headers.key;

    if (!key) {
      return res.status(401).json({
        status_code: "2",
        status: "failed",
        message: "API key required",
      });
    }

    const sqlCheckKey = "SELECT id FROM secret_key WHERE secret_key = ?";
    const valueCheckKey = [key];

    const [fetchedKey] = await connection.query(sqlCheckKey, valueCheckKey);

    if (fetchedKey.length === 0) {
      return res.status(422).json({
        status_code: "2",
        status: "failed",
        message: "Invalid API key",
      });
    }

    // Validate password and cpassword
    if (password !== cpassword) {
      return res.status(422).json({
        status_code: "2",
        status: "failed",
        message: "Password and confirm password do not match.",
      });
    }

    // Check for MD5 hash characteristics
    if (password.length !== 32 || !/^[a-f0-9]{32}$/.test(password)) {
      return res.status(422).json({
        status_code: "2",
        status: "failed",
        message: "Invalid password.",
      });
    }

    // Get user data from Authorization token
    const authHeader = req.headers.authorization;
    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        status_code: "2",
        status: "failed",
        message: "Authorization token required",
      });
    }

    const decodedToken = await jwt.verify(
      token,
      JWT_KEYS,
      async (err, payload) => {
        if (err) {
          return res.status(422).json({ error: err });
        }
        const { unique_id, secret_key } = payload;
        return { unique_id, secret_key };
      }
    );

    const [userData] = await connection.query(
      "SELECT * FROM login WHERE unique_id = ?",
      [decodedToken.unique_id]
    );

    if (userData.length === 0) {
      return res.status(404).json({
        status_code: "2",
        status: "failed",
        message: "User not found.",
      });
    }

    // Update password and coordinates in login table
    await connection.query(
      "UPDATE login SET password = ?, coordinates = ?, `key` = ? WHERE id = ?",
      [password, coordinates, decodedToken.secret_key, userData[0].id]
    );

    const loginToken = jwt.sign(
      { unique_id: userData[0].unique_id, secret_key: decodedToken.secret_key },
      JWT_KEYS
    );

    const statusMessages = {
      6: "Mobile Number Verification Pending",
      5: "Onboard Is Pending",
      4: "KYC Onboard Pending",
      3: "Territory Assign is Pending",
      2: "KYC Verification Pending",
      1: "Active",
      0: "Suspended",
    };

    return res.status(200).json({
      status_code: "01",
      status: statusMessages[userData[0].status],
      name: userData[0].name,
      mobile: userData[0].mobile_number,
      pin_status:
        userData[0].pin === null || !userData[0].pin
          ? "Not available"
          : "Available",
      customer_id: userData[0].customer_id,
      token: loginToken,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status_code: "1",
      status: "failed",
      message: "Internal Server Error",
    });
  } finally {
    await connection.release();
  }
});

router.post("/distributor-forgot-password", async (req, res) => {
  const connection = await poolPromise().getConnection();

  try {
    const { mobile, coordinates } = req.body;

    // Validate API key
    const key = req.headers.key;

    if (!key) {
      return res.status(401).json({
        status_code: "2",
        status: "failed",
        message: "API key required",
      });
    }

    const sqlCheckKey = "SELECT id FROM secret_key WHERE secret_key = ?";
    const valueCheckKey = [key];

    const [fetchedKey] = await connection.query(sqlCheckKey, valueCheckKey);

    if (fetchedKey.length === 0) {
      return res.status(422).json({
        status_code: "2",
        status: "failed",
        message: "Invalid API key",
      });
    }

    // Check if mobile number is valid
    const [userData] = await connection.query(
      "SELECT * FROM login WHERE mobile_number = ?",
      [mobile]
    );

    if (userData.length === 0) {
      return res.status(202).json({
        status_code: "2",
        status: "failed",
        message: "User not found.",
      });
    }

    const statusMessages = {
      2: "KYC Verification Pending",
      1: "Active",
    };

    // Check if status is 2 or 1
    if (userData[0].status === "2" || userData[0].status === "1") {
      // Generate OTP
      const otp = Math.floor(100000 + Math.random() * 900000);
      const saltedOTP = SALT.concat(otp);
      const hashedOTP = md5(saltedOTP);

      // Send OTP to Distributor's Registered Mobile
      await smsapi("admin", "otp_send", mobile, otp, "3 min");

      // Update coordinates and OTP in login table
      await connection.query(
        "UPDATE login SET coordinates = ?, otp = ? WHERE id = ?",
        [coordinates, hashedOTP, userData[0].id]
      );

      return res.status(200).json({
        status_code: "1",
        status: "success",
        unique_id: userData[0].unique_id,
        message: "OTP sent successfully.",
      });
    } else {
      return res.status(202).json({
        status_code: "2",
        status: "failed",
        message: "User not found.",
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Internal Server Error",
    });
  } finally {
    await connection.release();
  }
});

router.post("/distributor-reset-password", async (req, res) => {
  const connection = await poolPromise().getConnection();

  try {
    const { unique_id, password, otp, coordinates, mac_id, os } = req.body;

    // Validate API key
    const key = req.headers.key;

    if (!key) {
      return res.status(401).json({
        status_code: "2",
        status: "failed",
        message: "API key required",
      });
    }

    const sqlCheckKey = "SELECT id FROM secret_key WHERE secret_key = ?";
    const valueCheckKey = [key];

    const [fetchedKey] = await connection.query(sqlCheckKey, valueCheckKey);

    if (fetchedKey.length === 0) {
      return res.status(422).json({
        status_code: "2",
        status: "failed",
        message: "Invalid API key",
      });
    }

    // Check if OTP is valid
    const [userData] = await connection.query(
      "SELECT * FROM login WHERE unique_id = ? AND otp = ?",
      [unique_id, md5(SALT.concat(otp))]
    );

    if (userData.length === 0) {
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message: "Invalid OTP.",
      });
    }

    // Check if status is 1 or 2
    if (userData[0].status === "1" || userData[0].status === "2") {
      // Validate Password (Check for MD5 hash characteristics)
      if (password.length !== 32 || !/^[a-f0-9]{32}$/.test(password)) {
        return res.status(422).json({
          status_code: "2",
          status: "failed",
          message: "Invalid password.",
        });
      }

      const secret = (Math.random() + 1).toString(36).substring(2);
      const token = jwt.sign(
        { unique_id: userData[0].unique_id, secret_key: secret },
        JWT_KEYS
      );

      // Update new password, coordinates, mac id, os in login table
      await connection.query(
        "UPDATE login SET password = ?, coordinates = ?, mac_id = ?, os = ?, `key` = ? WHERE unique_id = ?",
        [password, coordinates, mac_id, os, secret, unique_id]
      );

      const statusMessages = {
        6: "Mobile Number Verification Pending",
        5: "Onboard Is Pending",
        4: "KYC Onboard Pending",
        3: "Territory Assign is Pending",
        2: "KYC Verification Pending",
        1: "Active",
        0: "Suspended",
      };

      return res.status(200).json({
        status_code: "01",
        status: statusMessages[userData[0].status],
        name: userData[0].name,
        mobile: userData[0].mobile_number,
        pin_status:
          userData[0].pin === null || !userData[0].pin
            ? "Not available"
            : "Available",
        customer_id: userData[0].customer_id,
        token,
      });
    } else {
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message: "Invalid status.",
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status_code: "1",
      status: "failed",
      message: "Internal Server Error",
    });
  } finally {
    await connection.release();
  }
});

//Distributor Login API end

//Field Sales Executive Login start

router.post("/fse-login", async (req, res) => {
  try {
    const { mobile_number, device_id, os, ip, coordinates } = req.body;
    const connection = await poolPromise().getConnection();

    // Check if FSE exists with the given mobile number
    const [fseResult] = await connection.query(
      "SELECT * FROM fse WHERE mobile_number = ?",
      [mobile_number]
    );

    if (fseResult.length === 0) {
      connection.release();
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message: "Unauthorized Access",
      });
    }

    const fse = fseResult[0];

    // Check FSE account status
    if (fse.status === "0") {
      connection.release();
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message: "Account suspended",
      });
    } else if (fse.status === "1") {
      // Match devices id
      if (fse.device_id !== device_id) {
        // Devices id not match, generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const saltedOTP = SALT.concat(otp);
        const hashedOTP = md5(saltedOTP);

        // Update OTP in the database
        await connection.query("UPDATE fse SET otp = ? WHERE id = ?", [
          hashedOTP,
          fse.id,
        ]);

        // Send OTP to user mobile

        smsapi("admin", "otp_send", mobile_number, otp, `3 min`);

        connection.release();
        return res.status(200).json({
          status_code: "022",
          status: "pending",
          message: "Login with OTP",
        });
      } else {
        // Devices id match, update timestamp, coordinates, os, ip, and release token
        const uniqueKey = uuid.v4();
        const hashedUniqueKey = md5(uniqueKey);
        const token = jwt.sign(
          {
            id: fse.unique_id,
            secret: hashedUniqueKey,
          },
          process.env.JWT_KEYS
        );

        await connection.query(
          "UPDATE fse SET timestamp = CURRENT_TIMESTAMP(), coordinates = ?, os = ?, ip = ?, secretkey = ? WHERE id = ?",
          [coordinates, os, ip, hashedUniqueKey, fse.id]
        );

        connection.release();
        return res.status(200).json({
          status_code: "1",
          status: "success",
          data: {
            agent_id: fse.agent_id,
            name: fse.name,
            balance: fse.balance,
            token: token,
          },
        });
      }
    } else {
      // Handle other account statuses if needed
      connection.release();
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message: "Invalid Account Status",
      });
    }
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Internal Server Error",
    });
  }
});

router.post("/fse-login-otp", async (req, res) => {
  try {
    const { mobile_number, otp, device_id, os, ip, coordinates } = req.body;
    const connection = await poolPromise().getConnection();

    // Check if FSE exists with the given mobile number
    const [fseResult] = await connection.query(
      "SELECT * FROM fse WHERE mobile_number = ?",
      [mobile_number]
    );

    if (fseResult.length === 0) {
      connection.release();
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message: "Unauthorized Access",
      });
    }

    const fse = fseResult[0];

    // Validate OTP
    const saltedOTP = SALT.concat(otp);
    const hashedOTP = md5(saltedOTP);

    if (fse.otp !== hashedOTP) {
      connection.release();
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message: "Invalid OTP",
      });
    }

    // OTP is validated, update timestamp, coordinates, os, ip, and release token
    const uniqueKey = uuid.v4();
    const hashedUniqueKey = md5(uniqueKey);
    const token = jwt.sign(
      {
        id: fse.unique_id,
        secret: hashedUniqueKey,
      },
      process.env.JWT_KEYS
    );

    await connection.query(
      "UPDATE fse SET timestamp = CURRENT_TIMESTAMP(), coordinates = ?, os = ?, ip = ?, secretkey = ?, device_id = ? WHERE id = ?",
      [coordinates, os, ip, hashedUniqueKey, device_id, fse.id]
    );

    connection.release();
    return res.status(200).json({
      status_code: "1",
      status: "success",
      data: {
        agent_id: fse.agent_id,
        name: fse.name,
        balance: fse.balance,
        token: token,
      },
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Internal Server Error",
    });
  }
});




//Field Sales Executive Login end

module.exports = router;
