

const express = require("express");
const router = express.Router();
const poolPromise = require("../util/connnectionPromise");
const poolPromise3 = require("../util/connectionPromise3");
const md5 = require("md5");
const uuid = require("uuid");
const SALT = process.env.SALT;
const axios = require("axios");
const crypto = require("crypto");
const smsapi = require("../globalfunction/sms");
const { savevirtualaccount, savevirtualaccount_user } = require("../globalfunction/savevirtualaccount");
const requireStaffLogin = require("../middleware/requireEmpLogin");
const path = require("path");
const multer = require("multer");
const moment = require("moment-timezone");
moment().tz("Asia/Calcutta").format();


// Configure multer storage for file uploads
const storages3 = multer.diskStorage({
    destination: "./assets/image/userdocs",
    filename: (req, file, cb) => {
      return cb(
        null,
        `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`
      );
    },
  });
  
  const upload3 = multer({
    storage: storages3,
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
  

// erp

router.get("/search-package", requireStaffLogin, async (req, res) => {
    
  const connection3 = await poolPromise3().getConnection();
    try {
        const [results] = await connection3.query(
            "SELECT package_id, packname, mrp, discount FROM scheme WHERE usertype = 'Merchant' AND status = 'Enable'",
            []
        );
      
  
      if (results.length === 0) {
        return res.status(404).json({
          status: "Fail",
          message: "Product not found",
        });
      }
  
      connection3.release();
      return res.status(200).json({
        status: "Success",
        data: results,
      });
    } catch (error) {
        console.error(error);
        connection3.release();
      return res.status(500).json({
        status: "Error",
        message: "Internal Server Error",
      });
    }
});
  
//Onboard New Distributor end

//Customer Services Point & Merchant Registered  start
router.post("/search-merchant", requireStaffLogin, async (req, res) => {
    const connection3 = await poolPromise3().getConnection();
  
    try {
      console.log('coming')
        const { mobile_number } = req.body;
        const emp_id = req.staff.emp_id;
        // Check if the user exists with the given mobile number
        const [userResult] = await connection3.query(
          "SELECT * FROM users WHERE mobile = ?",
          [ mobile_number]
        );
  
        if (userResult.length > 0) {
          const user = userResult[0];
  
          switch (user.status)
          {
            
            case "6":
              connection3.release();
              return res.status(200).json({
                status_code: "2",
                status: "failed",
                message: "User Account Suspended.",
              });
            
            case "5":
            case "4":
            connection3.release();
            return res.status(200).json({
              status_code: "2",
              status: "failure",
              message: "User Already Registered",
              
            });

            case "3":
              connection3.release();
              return res.status(200).json({
                status_code: "24",
                status: "pending",
                unique_id: user.unique_id,
                message: "Activated Merchant Services.",
              });
            
            case "2":
              connection3.release();
              return res.status(200).json({
                status_code: "23",
                status: "pending",
                unique_id: user.unique_id,
                message: "Merchant/CSP Onboard Business Profile Pending",
              });
            
            case "1":
              connection3.release();
              return res.status(200).json({
                status_code: "22",
                status: "pending",
                message: "Merchant/CSP Onboard Pending",
                unique_id: user.unique_id
              });
            
              case "0":
                // Mobile number not verified, generate OTP
                const otp = Math.floor(100000 + Math.random() * 900000).toString();
                const saltedOTP = SALT.concat(otp);
                const hashedOTP = md5(saltedOTP);
    
                // Update OTP in the database
                await connection3.query(
                  "UPDATE users SET otp = ? WHERE id = ?",
                  [hashedOTP, user.id]
                );
    
                console.log('otp is here ',otp)
                // Send OTP to user mobile
              // Send OTP to distributor mobile
                  // smsapi("admin", "otp_send", mobile_number, otp, `3 min`);
    
                connection3.release();
                return res.status(200).json({
                  status_code: "20",
                  status: "success",
                  unique_id: user.unique_id,
                  otp:otp,
                  message: "OTP Successfully Send to CSP/Merchant Mobile Number.",
                });
              
          }
        } else {
          // User not found, generate Unique Id and OTP
          const uniqueId = uuid.v4();
          const otp = Math.floor(100000 + Math.random() * 900000).toString();
          const saltedOTP = SALT.concat(otp);
            const hashedOTP = md5(saltedOTP);

            const [[getcustomerid]] = await connection3.query(
                "SELECT MAX(`customer_id`) as max_customer_id FROM users"
              );
              let customerid = "231632601";
              if (getcustomerid?.max_customer_id) {
                customerid = getcustomerid.max_customer_id + 1;
              }
  
          // Insert data into login_data table
          await connection3.query(
            "INSERT INTO users (user_type , unique_id, mobile, status, otp, `customer_id`, created_date, created_by ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ["Merchant", uniqueId, mobile_number, "0", hashedOTP, customerid, new Date().toISOString().substring(0, 10), emp_id ]
          );
  
          // Send OTP to user mobile
          // Send OTP to user mobile
         // Send OTP to distributor mobile
         smsapi("admin", "otp_send", mobile_number, otp, `3 min`);

  
          connection3.release();
          return res.status(200).json({
            status_code: "20",
            status: "success",
            unique_id: uniqueId,
            message: "OTP Successfully Sent to Merchant Mobile Number.",
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
      connection3.release();
    }
});
  

router.post("/verify-otp", requireStaffLogin, async (req, res) => {
    const { unique_id, otp} = req.body;
    try {
        const connection3 = await poolPromise3().getConnection();
  
      const [savedtranid] = await connection3.execute(
        "SELECT * FROM users WHERE unique_id = ?",
        [unique_id]
      );
  
      if (savedtranid.length === 0) {
        connection3.release();
        return res
          .status(404)
          .json({ status: "fail", message: "User not found" });
      }
  
      const user = savedtranid[0];
      const status = savedtranid[0].status;
      const saltedOTP = SALT.concat(otp);
        const hashedOTP = md5(saltedOTP);
        
        if (JSON.parse(status) === 0) {
          
            if (user.otp === hashedOTP) {
            
          const [sent_otp] = await connection3.execute(
            "UPDATE users SET  status = ? WHERE unique_id = ?",
            [ "1", unique_id]
          );
  
          if (sent_otp.affectedRows === 0) {
            connection3.release();
            return res.status(400).json({ status: "fail" });
          }
  
          connection3.release();
          return res.status(200).json({
            status: "success",
            statuscode: "06",
            message: "OTP verified go to login",
            unique_id
          });
        } else {
          connection3.release();
          return res.status(422).json({ status: "fail", message: "Invalid OTP" });
        }
      } else {
        connection3.release();
        return res
          .status(422)
          .json({ status: "fail", message: "Already verified your account" });
      }
    } catch (error) {
      console.error(error);
      return res.status(422).json({
        status: "Failed",
        statuscode: "2",
        message: "Something went wrong!",
      });
    }
});

router.post("/user-onbording", requireStaffLogin, async (req, res) => {

    const connection3 = await poolPromise3().getConnection();

      const {
        name,
        gender,
        date_of_birth,
        email_id,
        address,
        aadhar_no,
        pan_no,
          unique_id,
          package
        
      } = req.body;
      if (
        !unique_id ||
        !gender ||
        !date_of_birth ||
        !name ||
        !email_id ||
        !address
      ) {
        return res
          .status(404)
          .json({ status: "fail", message: "Invalid Values" });
      }
      try {
        
  
        const [savedtranid] = await connection3.execute(
          "SELECT * FROM users WHERE unique_id = ?",
          [unique_id]
        );
  
        if (savedtranid.length === 0) {
          connection3.release();
          return res
            .status(404)
            .json({ status: "fail", message: "User not found" });
        }
  
        const user = savedtranid[0];

        // const secretToken = user.secretToken;
    
    
        const [scheme] = await connection3.execute(
          "SELECT * FROM scheme WHERE package_id = ?",
          [package]
        );
  
        if (scheme.length === 0) {
          connection3.release();
          return res
            .status(400)
            .json({ status: "package not found", error: err });
        }
  
        const currentDate = new Date();
        let futureDate = new Date(currentDate.getTime());
        futureDate.setDate(currentDate.getDate() + parseInt(scheme[0].duration));
        const formattedFutureDate = futureDate.toISOString().substring(0, 10);
  
        futureDate.setDate(currentDate.getDate() - parseInt(scheme[0].duration));
        const activedate = futureDate.toISOString().substring(0, 10);
  
          const timestamp = Date.now().toString(); // Get current timestamp
        const randomDigits = Math.floor(Math.random() * 10000)
            .toString()
            .padStart(4, "0"); // Generate 4 random digits

          const randomOrderId = `${timestamp}${randomDigits}`;
          
        const schemeSummaryData = {
          order_id: randomOrderId,
          order_by: "",
          users_type: user.user_type,
          customer_id: user.customer_id,
          packid: package,
          packname: "",
          price: 0,
          gst: 0,
          total: 0,
          status: "Pending",
          validity: scheme[0].duration,
          activedate: activedate,
          expiredate: formattedFutureDate,
          tran_at: currentDate,
        };
  
        const [schemesummary] = await connection3.query(
          "INSERT INTO schemesummary (order_id, order_by, users_type, customer_id, packid, packname, price, gst, total, status, validity, activedate, expiredate, tran_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? )",
          [
            schemeSummaryData.order_id,
            schemeSummaryData.order_by,
            schemeSummaryData.users_type,
            schemeSummaryData.customer_id,
            schemeSummaryData.packid,
            schemeSummaryData.packname,
            schemeSummaryData.price,
            schemeSummaryData.gst,
            schemeSummaryData.total,
            schemeSummaryData.status,
            schemeSummaryData.validity,
            schemeSummaryData.activedate,
            schemeSummaryData.expiredate,
            schemeSummaryData.tran_at,
          ]
        );
  
        const [sent_otp] = await connection3.execute(
          "UPDATE users SET name = ?, email_id = ?, status = ?, package_id = ? WHERE unique_id = ? ",
          [
            name,
            email_id,
            "2",
            package,
            unique_id,
          ]
        );
  
        const [saveddata] = await connection3.execute(
          "SELECT * FROM profile WHERE unique_id = ?",
          [unique_id]
        );
  
        if (saveddata.length === 0) {
          var userdata = {
            unique_id: unique_id,
            gender: gender,
            date_of_birth: date_of_birth,
            address: JSON.stringify(address),
          };
          const [profile] = await connection3.query(
            "INSERT INTO profile (unique_id, gender, date_of_birth, address, pan_no, aadhar_no) VALUES (?, ?, ?, ?, ?, ?)",
            [
              userdata.unique_id,
              userdata.gender,
              userdata.date_of_birth,
              userdata.address,
              pan_no,
              aadhar_no,
            ]
          );
  
          var userWallet = {
            unique_id: unique_id,
            wallet: 0,
            status: "Enable",
          };
          const [wallet] = await connection3.query(
            "INSERT INTO wallet (unique_id, wallet, status) VALUES (?, ?, ?)",
            [userWallet.unique_id, userWallet.wallet, userWallet.status]
          );
  
          const [results] = await connection3.execute(
            "SELECT * FROM users WHERE unique_id = ?",
            [unique_id]
          );
          const package_id = results[0].package_id;
  
          if (!package_id) {
            connection3.release();
            return res
              .status(500)
              .json({ success: false, message: "Package ID not found" });
          }

            const [serviceData] = await connection3.execute(
                "SELECT * FROM service_with_packages WHERE packages_id = ?",
                [package_id]
              );
  
          if (!serviceData.length) {
            connection3.release();
            return res.status(500).json({
              success: false,
              message: "No services found for this package",
            });
          }
  
          const userData = serviceData.map((item) => [
            user.customer_id,
            item.packages_id,
            item.service_id,
            item.status,
          ]);
  
          await connection3.query(
            "INSERT INTO users_services (customer_id, packages_id, service_id, status) VALUES ?",
            [userData]
          );

            connection3.release();
            return res.status(200).json({
              status: "success",
              statuscode: "07",
              unique_id,
              message: "onboard Business Profile",
            });

        } else {
          connection3.release();
          return res.status(404).json({
            status: "fail",
            statuscode: "2",
            message: "already data updated",
          });
        }
      } catch (error) {
        console.log(error);
        return res.status(404).json({
          status: "Failed",
          statuscode: "2",
          message: "Something went wrong!",
        });
      }
    
});
  
router.post("/merchant-onbording", requireStaffLogin, async (req, res) => {
 
    try {

        const {
          entity_type,
          nature_of_business,
          legal_name,
          trade_name,
          pan_number,
          gst_no,
          udyam_number,
          date_of_registration,
          registration_no,
            address,
            unique_id
        } = req.body;
        
        
        if (!trade_name || !address || !pan_number) {
          return res.status(422).json({
            status: "fail",
            message: "Trade name,pan_number and address must be required.",
          });
        }
  
        const connection3 = await poolPromise3().getConnection();

  
        const [savedtranid] = await connection3.execute(
          "SELECT * FROM users WHERE unique_id = ?",
          [unique_id]
        );
  
        if (savedtranid.length === 0) {
          connection3.release();
          return res
            .status(404)
            .json({ status: "fail", message: "User not found" });
        }
  
        const user = savedtranid[0];
        const usertpe = user.user_type;
        const mac_id = user.mac_id;
        const mobile = user.mobile;
        const customer_id = user.customer_id;
        const package_id = user.package_id;
        const service_id = "8";
        // const secretToken = user.secretToken;
        const statuss =  "3" ;
       
        const [sent_otp] = await connection3.execute(
          "UPDATE users SET status = ? WHERE unique_id = ?",
          [statuss, unique_id]
        );
  
        if (sent_otp.affectedRows === 0) {
          connection3.release();
          return res.status(400).json({ status: "fail" });
        }
  
        const [saveddata] = await connection3.execute(
          "SELECT * FROM business_profile WHERE unique_id = ?",
          [unique_id]
      );
          
        if (saveddata.length === 0) {
          var userdata = {
            unique_id: unique_id,
            entity_type: entity_type || "NULL",
            nature_of_business: nature_of_business || "NULL",
            legal_name: legal_name || "NULL",
            trade_name: trade_name,
            pan_number: pan_number,
            gst_no: gst_no || "NULL",
            udyam_number: udyam_number || "NULL",
            date_of_registration:
              date_of_registration ||
              moment.utc(new Date()).local().format("YYYY-MM-DD HH:mm:ss"),
            registration_no: registration_no || "NULL",
            address: JSON.stringify(address, replacerFunc()),
          };
          try
          {
            const [results] = await connection3.query(
              "INSERT INTO business_profile SET ?",
              [userdata])
            
              if (results.affectedRows === 0) {
                connection3.release();
                return res
                  .status(500)
                  .json({ success: false, message: "Internal server error" });
              }
            } 
      catch (error)
          {
            console.log(error)
          }
       
  
          const [users_services] = await connection3.query(
            "SELECT * FROM users_services WHERE packages_id = ? AND customer_id = ? AND service_id = ?",
            [package_id, customer_id, service_id]
          );
            console.log(users_services,"users_services")
          if (users_services[0].status === "Enable") {
            const result_value = await savevirtualaccount_user(
              req,
              res,
              unique_id,
              trade_name,
              pan_number,
              address
            );
            
              return res.status(200).json({
                status: "success",
                  statuscode: "01",
                  massage: "Successfully created."
                
              });
           
          } else {
            return res.status(200).json({
              status: "success",
              statuscode: "01",
              massage: "virtual_account Not created!"
              
            });
          }
        } else {
          connection3.release();
          return res.status(404).json({
            status: "fail",
            statuscode: "2",
            message: "Data already updated",
          });
        }
     
    } catch (error) {
      console.error(error);
      return res.status(422).json({
        status: "Failed",
        statuscode: "2",
        message: "Something went wrong!",
      });
    }
});

router.post("/activate-services", requireStaffLogin, async (req, res) => {
      
  const connection3 = await poolPromise3().getConnection();

  try {

      const {
              payment,
            unique_id
        } = req.body;

      if (payment === 'cash') {

        const [usersdata] = await connection3.execute(
          "SELECT * FROM users WHERE unique_id = ?",
          [unique_id]
        );

      const [schemesummarydata] = await connection3.execute(
          "SELECT expiredate FROM schemesummary WHERE customer_id = ?",
          [usersdata[0].customer_id]
          );
          const [schemesummary] = await connection3.execute(
              "UPDATE schemesummary SET status = ? WHERE customer_id = ? ",
              [
                'Success',
                usersdata[0].customer_id,
              ]
          );
          
          const [users] = await connection3.execute(
              "UPDATE users SET expiry = ? WHERE unique_id = ? ",
                [
                  schemesummarydata[0].expiredate,
                unique_id,
              ]
          );
          
          if (schemesummary.affectedRows > 0 && users.affectedRows > 0) { 
              return res.status(200).json({
                  status_code: "1",
                  status: "success",
                  message: "Services Activated successfully.",
                });
          } else {
              return res.status(500).json({
                  status_code: "2",
                  status: "failed",
                  message: "failed to update data."
                });
          }

         
      } else {
          return res.status(500).json({
              status_code: "2",
              status: "failed",
              message: "Services Activated failed. Change your payment method."
            });
      }

    
  } catch (error) {
    console.error(error);
    connection3.release();
    return res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Internal Server Error",
    });
  }
});
  
const replacerFunc = () => {
    const visited = new WeakSet();
    return (key, value) => {
      if (typeof value === "object" && value !== null) {
        if (visited.has(value)) {
          return;
        }
        visited.add(value);
      }
      return value;
    };
  };




  module.exports = router;
