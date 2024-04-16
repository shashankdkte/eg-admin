const express = require("express");
const router = express.Router();
const poolPromise = require("../util/connnectionPromise");
const uuid = require("uuid");
const axios = require("axios");
const sentOtp = require("../globalfunction/sentOtp");
const { isEmpty } = require("lodash");

router.get("/zone", async (req, res) => {
  const connection = await poolPromise().getConnection();
  try {
    const { key } = await req.headers;
    const sql_check_sec_key = "SELECT id FROM secret_key WHERE secret_key = ?";
    const value = [key];
    const [fetchedKey] = await connection.query(sql_check_sec_key, value);

    if (fetchedKey.length === 0) {
      return res
        .status(422)
        .json({ status_code: "2", status: "failed", message: "INVALID API KEY" });
    } else {
      // Fetch data from zone_tab
      const sql = "SELECT * FROM zone_tab WHERE 1";
      const values = [];
      const [data] = await connection.query(sql, values);

      if (isEmpty(data)) {
        res.status(200).json({
          status_code: "2",
          status: "failed",
          data: [],
          message: "Not Found",
        });
      } else {
        res.status(200).json({
          status_code: "1",
          status: "success",
          data: data,
        });
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

router.get("/pincode/:pincode", async (req, res) => {
  const connection = await poolPromise().getConnection();

  const pincode = req.params.pincode;
  if (!pincode || pincode.length < 6 || pincode.length > 6) {
    return res.status(422).json({
      status_code: "2",
      status: "failed",
      message: "Please provide 6 digit pincode",
    });
  }

  const { key } = await req.headers;
  const sql_check_sec_key = "SELECT id FROM secret_key WHERE secret_key = ?";
  const value = [key];
  const [fetchedKey] = await connection.query(sql_check_sec_key, value);

  if (fetchedKey.length === 0) {
    return res
      .status(422)
      .json({ status_code:"2",status: "failed", message: "INVALID API KEY" });
  }

  try {
    const sql = "SELECT * FROM area WHERE pincode = ?";
    const value = [pincode];
    const [area] = await connection.query(sql, value);

    if (area.length === 0) {
      axios
        .get("https://api.postalpincode.in/pincode/" + pincode)
        .then(async (response) => {
          const [data] = response.data;
          // console.log(data);
          if (data) {
            let arr = data.PostOffice || null;
            // console.log({ arr });
            if (arr === null) {
              const sql1 = "SELECT * FROM area_data WHERE pincode = ?";
              const value1 = [pincode];
              const [area] = await connection.query(sql1, value1);
              return res.status(200).send({
                status_code: "1",
                status: "success",
                data: area.map(({ name, district, division, state }) => ({
                  area_name: name,
                  division,
                  district,
                  state,
                })),
              });
            }
            let sql = `INSERT INTO area (
             name,
             district,
             division,
             state,
             pincode
             
           )
           VALUES `;

            sql += arr
              .map((postOffice) => {
                return `("${postOffice.Name}", "${postOffice.District}", "${postOffice.Division}", "${postOffice.State}", "${postOffice.Pincode}")`;
              })
              .join(", ");

            await connection.query(sql);

            console.log("data saved");
            return res.status(200).send({
              status_code: "1",
              status: "success",
              data: arr.map(({ Name, District, Division, State }) => ({
                area_name: Name,
                division: Division,
                district: District,
                state: State,
              })),
            });
          }
        })
        .catch(async (error) => {
          // console.log(error);
          const sql1 = "SELECT * FROM area_data WHERE pincode = ?";
          const value1 = [pincode];
          const [area] = await connection.query(sql1, value1);
          return res.status(200).send({
            status_code: "1",
            status: "success",
            data: area.map(({ name, district, division, state }) => ({
              area_name: name,
              division,
              district,
              state,
            })),
          });
        });
    } else {
      return res.status(200).send({
        status_code: "1",
        status: "success",
        data: area.map(({ name, district, division, state }) => ({
          area_name: name,
          division,
          district,
          state,
        })),
      });
    }
  } catch (err) {
    console.log("error", err);
    return res.status(422).json({ status_code:"2",status: "failed", error: err });
  } finally {
    await connection.release();
  }
});

router.post("/location", async (req, res) => {
  const { coordinates } = req.body;
  console.log("coordinates", coordinates);

  const connection = await poolPromise().getConnection();
  try {
    const sql = "SELECT * FROM geolocation WHERE coordinates = ?";
    const value = [coordinates];
    const [geolocation] = await connection.query(sql, value);

    if (geolocation.length === 0) {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coordinates}&sensor=false&key=AIzaSyCrdAWMU82Eoed3o3WU5lu_0Q6aJFfrdl0`;
      console.log("url", url);

      const settings = { method: "POST" };
      const response1 = await axios.post(url, settings);
      const location = await response1.data;

      //   const response = await fetch(url, settings);
      //   const location = await response.json();

      // console.log("response1111111111111",response1,"response1111111111111","responseeeeeeeeeeee",response);
      // console.log({ location });
      // console.log(response1.data);

      if (location.status === "OK") {
        let result = location.results[0];
        const addressComponents = result.address_components;

        const formatted_address = result.formatted_address;
        const city = addressComponents.find((component) =>
          component.types.includes("locality")
        ).long_name;
        const state = addressComponents.find((component) =>
          component.types.includes("administrative_area_level_1")
        ).long_name;
        const pincode = addressComponents.find((component) =>
          component.types.includes("postal_code")
        ).long_name;

        const sql1 = `INSERT INTO geolocation (coordinates, address, area, district, pincode, state) VALUES (?, ?, ?, ?, ?, ?)`;
        const value1 = [
          coordinates,
          formatted_address,
          city,
          city,
          pincode,
          state,
        ];
        await connection.query(sql1, value1);

        res.json({
          status_code: "1",
          status: "success",
          message: "Geolocation Address",
          data: {
            coordinates,
            address: formatted_address,
            area: city,
            district: city,
            pincode,
            state,
          },
        });
      } else {
        throw new Error("Geocode not found");
      }
    } else {
      const geolocationData = geolocation[0];
      res.json({
        status_code: "1",
        status: "success",
        message: "Geolocation address found in db",
        data: {
          coordinates,
          address: geolocationData.address,
          area: geolocationData.area,
          district: geolocationData.district,
          pincode: geolocationData.pincode,
          state: geolocationData.state,
        },
      });
    }
  } catch (err) {
    console.log("error", err);
    res.status(422).json({ status_code:"2",status: "failed", error: err.message });
  } finally {
    if (connection) {
      await connection.release();
    }
  }
});

router.get("/state", async (req, res) => {
  const connection = await poolPromise().getConnection();
  try {
    const { key } = await req.headers;

    // Check secret key
    const sql_check_sec_key = "SELECT id FROM secret_key WHERE secret_key = ?";
    const value = [key];
    const [fetchedKey] = await connection.query(sql_check_sec_key, value);

    if (fetchedKey.length === 0) {
      return res
        .status(422)
        .json({status_code:"2",status: "failed", message: "INVALID API KEY" });
    } else {
      // Fetch data from state
      const sql = "SELECT state_id,state_name FROM state WHERE 1";
      const values = [];
      const [data] = await connection.query(sql, values);

      if (isEmpty(data)) {
        res.status(200).json({
          status_code: "2",
          status: "failed",
          data: [],
          message: "Not Found",
        });
      } else {
        res.status(200).json({
          status_code: "1",
          status: "success",
          type: "Response",
          data: data,
        });
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

router.get("/district/:state_id", async (req, res) => {
  // Use promise-based connection
  const connection = await poolPromise().getConnection();
  try {
    const { key } = await req.headers;
    const { state_id } = req.params;

    // Check secret key
    const sql_check_sec_key = "SELECT id FROM secret_key WHERE secret_key = ?";
    const value = [key];
    const [fetchedKey] = await connection.query(sql_check_sec_key, value);

    if (fetchedKey.length === 0) {
      res
        .status(200)
        .json({ status_code: "2", status: "failed", message: "INVALID API KEY" });
    } else {
      // Fetch data from district
      const sql = "SELECT * FROM district WHERE state_id = ? ";
      const values = [state_id];
      let [data] = await connection.query(sql, values);

      data = data.map((res) => {
        return {
          dist_id: res.dist_id,
          district_name: res.district_name,
          state_id: res.state_id,
          state_name: res.state_name,
          zone_name: res.zone_name,
          zone_code: res.zone_code,
        };
      });

      if (isEmpty(data)) {
        res.status(200).json({
          status_code: "2",
          status: "failed",
          data: [],
          message: "Not Found",
        });
      } else {
        res.status(200).json({
          status_code: "1",
          status: "success",
          data: data,
        });
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

router.post("/contactform", async (req, res) => {
  // Use promise-based connection
  const connection = await poolPromise().getConnection();

  try {
    const { key } = req.headers;
    const sql_check_sec_key = "SELECT id FROM secret_key WHERE secret_key = ?";
    const value = [key];

    // Check secret key
    const [fetchedKey] = await connection.query(sql_check_sec_key, value);

    if (fetchedKey.length === 0) {
      return res
        .status(422)
        .json({status_code:"2" ,status: "failed", message: "INVALID API KEY" });
    } else {
       const { name, contactNo, emailId, subject, message } = req.body;
      //const { name, contact_no:contactNo, email_id:emailId, subject, message } = req.body;
      

      const sql = `INSERT INTO contact_form (name, contact_no, email_id, subject, message, status) VALUES (?, ?, ?, ?, ?, ?)`;
      const values = [name, contactNo, emailId, subject, message, 1];
  

      const check_sql = `SELECT * FROM contact_form WHERE contact_no=?`;
       const check_values = [contactNo];
     

      // Check if contact_no already exists
      const [data] = await connection.query(check_sql, check_values);

      if (isEmpty(data)) {
        // If contact_no doesn't exist, insert the data
        await connection.query(sql, values);
        return res.status(200).json({
          status_code: "1",
          status: "success",
          data: { message: "Successfully Inserted" },
        });
      } else {
        // If contact_no already exists, return a failure response
        return res.status(200).json({
          status_code: "2",
          status: "failed",
          message: "Already Exists",
        });
      }
    }
  } catch (err) {
    console.log("error", err);
    return res
      .status(422)
      .json({ status_code: "2", status: "failed", error: err.message });
  } finally {
    if (connection) {
      await connection.release();
    }
  }
});

router.post("/generateOtp", async (req, res) => {
  // Use promise-based connection
  const connection = await poolPromise().getConnection();
  try {
    const { key } = await req.headers;
    const { userType, mobileNo, emailId } = req.body;

  
    // Generate UUID for unique_id
    const uqid = uuid.v4();

    // Generate OTP
    let otp = `${Math.floor(100000 + Math.random() * 900000)}`;
    otp = await Buffer.from(otp, "utf8").toString("base64");
   // console.log(otp);

    // Check secret key
    const sql_check_sec_key = "SELECT id FROM secret_key WHERE secret_key = ?";
    const value = [key];
    const [fetchedKey] = await connection.query(sql_check_sec_key, value);

    if (fetchedKey.length === 0) {
      return res
        .status(422)
        .json({ status_code:"2",status: "failed", message: "INVALID API KEY" });
    } else {
      // Check if the mobile number exists in the new_lead table
      const check_sql = `SELECT * FROM new_lead WHERE mobile_no=?`;
      const check_values = [mobileNo];
      const [dt] = await connection.query(check_sql, check_values);

      // Prepare SQL statements
      const insert_sql = `INSERT INTO new_lead (unique_id, user_type, mobile_no, email_id, name, dob, aadhar_no, pan_no, company_name, address, otp, timestamp, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      const insert_values = [
        uqid,
        userType,
        mobileNo,
        emailId,
        null,
        null,
        null,
        null,
        null,
        null,
        otp,
        Date.now().toString(),
        "not-verify",
      ];

      const update_sql = `UPDATE new_lead SET otp=? WHERE mobile_no=?`;
      const update_values = [otp, mobileNo];

      if (dt.length === 0) {
        if (mobileNo.toString().length == 10) {
          // Send OTP and insert new record
          await sentOtp(
            Buffer.from(otp, "base64").toString("utf8"),
            "10min",
            1,
            mobileNo
          );
          const [data] = await connection.query(insert_sql, insert_values);
          console.log(data);
          console.log(otp);
          if (data.affectedRows >= 1) {
            return res.status(200).json({
              status_code: "1",
              status: "success",
              data: { message: "Otp sent successfully", uuid: uqid, otp:otp },
            });
          } else {
            return res.status(201).json({
              status_code: "2",
              status: "failed",
              data: { message: "Phone Number already verified" },
            });
          }
        } else {
          return res.status(200).json({
            status_code: "2",
            status: "failed",
            data: {
              message: "Invalid Mobile Number",
            },
          });
        }
      } else {
        // Update OTP and handle existing records

        await connection.query(update_sql, update_values);
       

        if (dt[0].status === "Not-Verify") {
          await sentOtp(
            Buffer.from(otp, "base64").toString("utf8"),
            "10min",
            1,
            mobileNo
          );

          return res.status(200).json({
            status_code: "1",
            status: "success",
            data: { message: "Otp sent successfully", uuid: dt[0].unique_id,otp:otp  },
          });
        } else if (dt[0].status === "Verify") {
          return res.status(200).json({
            status_code: "2",
            status: "failed",
            data: { message: "Phone Number already verified" },
          });
        } else {
          return res.status(200).json({
            status_code: "2",
            status: "failed",
            message: "User Already Exist",
          });
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


router.post("/verifyOtp", async (req, res) => {
  // Use promise-based connection
  const connection = await poolPromise().getConnection();
  try {
    const { key } = await req.headers;
    // const { unique_id:uniqueId, otp } = req.body;
    const { uniqueId, otp } = req.body;

    // Check secret key
    const sql_check_sec_key = "SELECT id FROM secret_key WHERE secret_key = ?";
    const value = [key];
    const [fetchedKey] = await connection.query(sql_check_sec_key, value);
   

    if (fetchedKey.length === 0) {
      return res
        .status(422)
        .json({ status_code:"2",status: "failed", message: "INVALID API KEY" });
    } else {
      // Update the new_lead table with the verified status
      const values = [
        "verify",
        // Buffer.from(otp, "utf8").toString("base64"),
        otp,
        uniqueId,
      ];
      console.log(values)
      const sql = "UPDATE new_lead SET status=? WHERE otp=? AND unique_id=?";
      const [data] = await connection.query(sql, values);

      if (data.affectedRows >= 1) {
        return res.status(200).json({
          status_code: "1",
          status: "success",
          data: { message: "OTP verified successfully", uuid: uniqueId },
        });
      } else {
        return res.status(200).json({
          status_code: "2",
          status: "failed",
          data: { message: "OTP Incorrect" },
        });
      }
    }
  } catch (err) {
    console.log(err);
    return res.status(422).json({ status_code:"2",status: "failed", error: err.message });
  } finally {
    if (connection) {
      await connection.release();
    }
  }
});

router.post("/generateNewLead", async (req, res) => {
  // Use promise-based connection
  const connection = await poolPromise().getConnection();
  try {
    const { key } = await req.headers;
    const { uniqueId, name, dob, emailId, adhar, pan, companyName, address } =
      req.body;

    // Check secret key
    const sql_check_sec_key = "SELECT id FROM secret_key WHERE secret_key = ?";
    const value = [key];
    const [fetchedKey] = await connection.query(sql_check_sec_key, value);

    if (fetchedKey.length === 0) {
      return res
        .status(422)
        .json({status_code:"2", status: "failed", message: "INVALID API KEY" });
    } else {
      // Check if the lead with uniqueId already exists
      const sql_check = "SELECT * FROM new_lead WHERE unique_id=?";
      const values_check = [uniqueId];
      const [dt] = await connection.query(sql_check, values_check);

      try {
        if (dt[0].status !== "Not-Verify") {
          // Update the existing lead
          const sql =
            "UPDATE new_lead SET status=?, name=?, dob=?, aadhar_no=?, pan_no=?, company_name=?, address=? WHERE unique_id=?";
          const values = [
            "pending",
            name,
            dob,
            adhar,
            pan,
            companyName,
            address,
            uniqueId,
          ];
          const [data] = await connection.query(sql, values);

          if (data.affectedRows >= 1) {
            return res.status(200).json({
              status_code: "1",
              status: "success",
              data: { message: "New Lead Created" },
            });
          } else {
            return res.status(200).json({
              status_code: "1",
              status: "success",
              data: { message: "User not verified" },
            });
          }
        } else {
          return res.status(201).json({
            data: {
              message: "Already created",
            },
          });
        }
      } catch (err) {
        return res.status(200).json({
          status_code: "2",
          status: "failed",
          data: {
            message: err,
          },
        });
      }
    }
  } catch (err) {
    console.log(err);
    return res.status(422).json({ status_code:"2",status: "failed", error: err.message });
  } finally {
    if (connection) {
      await connection.release();
    }
  }
});

// router.get('/branch/:pin', async(req, res) => {
//   var { key } = await req.headers;
//   var { pin } = req.params;
//   pool().getConnection(async function(err, connection) {
//       const sql_check_sec_key = 'SELECT id FROM secret_key WHERE secret_key = ?';
//       const value = [key]
//       await sqlQuery(connection, sql_check_sec_key, value).then(async(fetchedKey) => {
//           if (fetchedKey.length === 0) {
//               return res.status(422).json({ status: "fail", message: "INVALID API KEY" })
//           } else {
//               var sql = "SELECT * FROM branch WHERE pin=?";
//               var values = [pin];
//               sqlQuery(connection, sql, values)
//                   .then((data) => {
//                       if (isEmpty(data)) {
//                           res.status(200).json({
//                               status_code: 2,
//                               status: "Failed",
//                               data: [],
//                               message: "Not Found",
//                           })
//                       } else {
//                           res.status(200).json({
//                               status_code: 1,
//                               status: "Success",
//                               data: data
//                           })
//                       }
//                   })
//                   .catch(err => {
//                       console.log(err)
//                       return res.status(422).json({status_code: 2, status: "fail", error: err })
//                   })
//                   .finally(() => {
//                       connection.release();
//                   })
//           }
//       })
//   })
// })

module.exports = router;
