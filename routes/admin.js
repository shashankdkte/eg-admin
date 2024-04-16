const express = require("express");
const router = express.Router();
const poolPromise = require("../util/connnectionPromise");
const poolPromise2 = require("../util/connnectionPromise2");
const poolPromise3 = require("../util/connectionPromise3");
const uuid = require("uuid");
const smsapi = require("../globalfunction/sms");
const requireAdminLogin = require("../middleware/requireAdminLogin");
const { sendPushNotification } = require("../globalfunction/pushNotification");
const getDBPool = require("../util/connectionPromise3");

router.get("/web_navigation", requireAdminLogin, async (req, res) => {
  try {
    // Use promise-based connection
    const connection = await poolPromise().getConnection();

    try {
      const sql =
        "SELECT * FROM web_navigation WHERE parent = ? AND user_type = ? AND status = 'Enable' ORDER BY orderby";
      const value = [0, "Admin"];

      const [parent_menu] = await connection.query(sql, value);

      const menu = [];
      for (let i = 0; i < parent_menu.length; i++) {
        const parent_id = parent_menu[i].id;
        const sql1 =
          "SELECT * FROM web_navigation WHERE parent = ? AND user_type = ? AND status = 'Enable' ORDER BY orderby";
        const value1 = [parent_id, "Admin"];

        const [submenu] = await connection.query(sql1, value1);

        const data = {
          parent_menu: parent_menu[i],
          sub_menu: submenu,
        };
        menu.push(data);
      }

      return res
        .status(200)
        .json({ status_code: "1", status: "success", menu: menu });
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

//Manag Employee

router.get("/get-department", requireAdminLogin, async function (req, res) {
  try {
    // Use promise-based connection
    const connection = await poolPromise().getConnection();

    try {
      const sql = "SELECT * FROM department";
      const values = [];

      const [data] = await connection.query(sql, values);

      return res.status(200).json({
        status_code: "1",
        status: "success",
        secret_key: data,
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

router.get("/get-designation/:department_id",requireAdminLogin,
  async (req, res) => {
    try {
      // Use promise-based connection
      const connection = await poolPromise().getConnection();

      try {
        const { department_id } = req.params;
        const sql =
          "SELECT department_id, designation_id, designation, no_of_vacancy, status FROM designation WHERE department_id = ?";
        const values = [department_id];

        const [data] = await connection.query(sql, values);

        return res.status(200).json({
          status_code: "1",
          status: "success",
          data: data,
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
  }
);
//sms pending
router.post("/add-employee", requireAdminLogin, async (req, res) => {
  try {
    const { accountid } = req.admin;
    //zoone code body me extra aayega uss random empid bananni he 
    const { department_id, designation_id, Name, contact_no, email_id,zoneCode } =
      req.body;
    const uqid = uuid.v4();
    let department, designation, Employee_ID, application_id;

    // Use promise-based connection
    const connection = await poolPromise().getConnection();

    try {
      const sql_check_sec_key = "SELECT * FROM staff_data WHERE mobile = ?";
      const value = [contact_no];

      const [staff_data] = await connection.query(sql_check_sec_key, value);

      if (staff_data.length > 0) {
        return res
          .status(422)
          .json({ status_code: "2", status: "failed", message: "Staff already exists" });
      } else {
        //Department start
        const sql_department =
          "SELECT designation FROM designation WHERE designation_id = ? AND department_id = ?";
        const values_department = [designation_id,department_id];
        const [designation_data] = await connection.query(
          sql_department,
          values_department
        );

        if(designation_data.length == 0){
          return res.status(200).json({
            status_code: "2",
            status: "Error",
            Message: "Designation and departmetn id not found in designation ",
          });
        }

        console.log('both id data for degination',designation_data)
        designation = designation_data[0].designation;

        //Department end

        //Designation start
        const sql_designation =
          "SELECT department FROM department WHERE id = ?";
        const values_designation = [department_id];
        const [department_data] = await connection.query(
          sql_designation,
          values_designation
        );

        department = department_data[0].department;
        //Designation end

        const randomDigits = Math.floor(10000 + Math.random() * 90000);
        // Concatenate zone code and random digits
        Employee_ID = zoneCode + randomDigits.toString();
    console.log('employee id ',Employee_ID)
        // const fouth_digit = String(accountid).slice(0, 4);
        // Employee_ID = fouth_digit + String(Date.now()).slice(-5);
        application_id = Date.now();
        //  let designation =designation
        const insertValues = [
          application_id,
          uqid,
          department_id,
          designation_id,
          Employee_ID,
          Name,
          contact_no,
          email_id,
          zoneCode,
          designation,
          department
        ];

        const sql_insert =
          "INSERT INTO `staff_data` (`application_id`,`unique_id`, `department_id`, `designation_id`, `emp_id`, `name`, `mobile`, `email`, `mapping`,`designation`,`department`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,?,?)";

        const [insertData] = await connection.query(sql_insert, insertValues);

        if (insertData.affectedRows >= 1) {
          await smsapi(
            "admin",
            "employee_on_boarded",
            contact_no,
            designation
            );
          return res.status(200).json({
            status_code: "1",
            status: "success",
            Employee_ID,
            Name,
            Message: "Successfully Registered",
          });
        }
      }
    } catch (err) {
      console.error(err);
      return res.status(422).json({ status: "failed", error: err.message });
    } finally {
      // Release the connection
      if (connection) {
        await connection.release();
      }
    }
  } catch (err) {
    return res.status(422).json({ status: "failed", error: err.message });
  }
});

router.get("/employee-list/:status", requireAdminLogin, async (req, res) => {
  try {
    // Use promise-based connection
    const connection = await poolPromise().getConnection();
    //give :status 8 to 3 for NON-KYC , 2 = KYC-Pending, 1 = Active and 0 = Account is Suspended
    const statusCode = Number(req.params.status);
    try {
      if (statusCode <= 8 && statusCode >= 3) {
        var [staffData] = await connection.query(
          'SELECT application_id, department, designation, emp_id, name, mobile, status FROM staff_data WHERE status <= "8" AND status >= "3"'
        );
      } else {
        var [staffData] = await connection.query(
          "SELECT application_id, department, designation, emp_id, name, mobile, status FROM staff_data WHERE status = ? ",
          [String(statusCode)]
        );
      }
      const staff_status_data = {
        8: "Password is Not Set",
        7: "Terms and conditions accepted is pending",
        6: "Update Profile is Pending",
        5: "Update personal Document",
        4: "Education Details Update pending",
        3: "Working Experience update is Pending",
        2: "Approval Pending",
        1: "Approved/Active",
        0: "Account is Suspended",
      };
      if (staffData.length === 0) {
        return res.status(200).json({
          status_code: "2",
          status: "failed",
          data: `Data not found for Status:${statusCode} - (${
            staff_status_data[String(statusCode)]
          })`,
        });
      }

      return res.status(200).json({
        status_code: "1",
        status: "success",
        data: staffData,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        status_code: "2",
        status: "failed",
        message: "Something went wrong",
      });
    } finally {
      // Release the connection
      await connection.release();
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Something went wrong",
    });
  }
});

router.get("/get-employee-details/:applicationId", requireAdminLogin,
  async (req, res) => {
    try {
      // Use promise-based connection
      const connection = await poolPromise().getConnection();

      try {
        const applicationId = req.params.applicationId;

        const query = `
          SELECT sd.application_id, sd.department, sd.designation, sd.name, sd.mobile,
          p.gorgon_name, p.gender, p.marital_status, p.date_of_birth, p.nationality,
          p.pan_number, p.aadhaar_number, p.address, p.aadhaar_front, p.aadhaar_back,
          p.pan_front, p.signature, p.tnc, p.cv, p.photo, p.status
          FROM staff_data sd
          INNER JOIN emp_profile p ON sd.unique_id = p.unique_id
          WHERE sd.application_id = ?
          `;

        const [staffData] = await connection.query(query, [applicationId]);

        if (staffData.length === 0) {
          res.status(202).json({
            status_code: "2",
            status: "failed",
            message: "Invalid application_id",
          });
        } else {
          res.status(200).json({
            status_code: "1",
            status: "success",
            data: staffData[0],
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
        // Release the connection
        await connection.release();
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({
        status_code: "2",
        status: "failed",
        message: "Internal server error",
      });
    }
  }
);

router.get("/-shifts", requireAdminLogin, async (req, res) => {
  var connection = await poolPromise().getConnection();

  try {
    // Fetch only 'Enable' shifts from the shifts table
    const [shiftsData] = await connection.query(
      "SELECT * FROM shifts WHERE status = 'Enable'"
    );

    return res.status(200).json({
      status_code: "1",
      status: "success",
      data: shiftsData,
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({
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

router.post("/appoint", requireAdminLogin, async (req, res) => {
  try {
    // Use promise-based connection
    const connection = await poolPromise().getConnection();
    const approve_by = req.admin.accountid;
   
    try {
   
      const {
        applicationId,
        joiningDate,
        managerId,
        Salary,
        shifts_id,
        office_mobile,
        office_email,
        territory,
      } = req.body;

      if(territory && territory.length >0 && !territory[0].state_name || !territory[0].district_name){
             return res.send({statuscode : 2,status :'failed',message:'please send district_name and state_name in territory array'})
      }

      console.log('application id ',applicationId)
      const [staff_data] = await connection.query(
        `SELECT * FROM staff_data WHERE application_id = ? AND status = '2' `,
        [applicationId]
      );

      console.log('data',staff_data);

      if (staff_data.length === 0) {
       return res.status(202).json({
          status_code: "2",
          status: "failed",
          message: "Invalid application_id or status not match",
        });
      }

      // console.log('one man army ',staff_data)
      if (staff_data[0].department_id == 2) {
        if (territory) {
          console.log('coming for territory')

          // console.log('one man army ',staff_data[0])
          // Insert territory data if provided
          //ek user Type me 

          // emp type two he sales // sales manage ro multiple distirict assign kar skta
          // area salsssses manager ko multiple district assign ho skta


          // for (const { district_name ,state_name} of territory) {
          //   const [district] = await connection.query(
          //     `SELECT * FROM district WHERE district_name = ? state_name = ?` ,
          //     [district_name,state_name]
          //   );
          //   if (district.length === 0) {
          //     res.status(404).json({
          //       status_code: "2",
          //       status: "failed",
          //       message: " Invalid district name",
          //     });
          //   }

         
          for (const { district_name, state_name } of territory) {
            try {
                const [district] = await connection.query(
                    `SELECT * FROM district WHERE district_name = ? AND state_name = ?`,
                    [district_name, state_name]
                );
        
                if (district.length === 0) {
                    return res.status(404).json({
                        status_code: "2",
                        status: "failed",
                        message: "Invalid district name",
                    });
                }
        
                console.log('district state', district_name, state_name);
        
                const [existingTerritory] = await connection.query(
                    `SELECT * FROM territory WHERE district = ? AND state = ? AND user_type = ?`,
                    [district_name, state_name, staff_data[0].designation_id]
                );
        
                if (existingTerritory.length > 0) {
                    return res.status(404).json({
                        status_code: "2",
                        status: "failed",
                        message: `This user_type already exists in the territory table with the same district and state`,
                    });
                }
        
                console.log('territory is here', existingTerritory);
        
                await connection.query(
                    `
                    INSERT INTO territory (user_type, unique_id, pincode, district, state, status)
                    VALUES (?, ?, ?, ?, ?, 'Enable')
                    `,
                    [
                        staff_data[0].designation_id,
                        staff_data[0].unique_id,
                        " ",
                        district[0].district_name,
                        district[0].state_name,
                    ]
                );
        
            } catch (error) {
                console.error('Error processing territory:', error);
                return res.status(500).json({
                    status_code: "2",
                    status: "failed",
                    message: "Internal server error",
                });
            }
        }
        
           
            await connection.query(
              `
                UPDATE staff_data
                SET joining_date = ?, mapping = ?, salary = ?, approve_by = ?, shifts_id = ?, office_mobile = ?, office_email = ?, status = '1'
                WHERE application_id = ?
              `,
              [
                joiningDate,
                managerId,
                Salary,
                approve_by,
                shifts_id,
                office_mobile,
                office_email,
                applicationId,
              ]
            );

            await smsapi(
              "admin",
              "appoint",
              staff_data[0].mobile,
              staff_data[0].designation,
              staff_data[0].emp_id,
            );

            return res.status(200).json({
              status_code: "1",
              status: "success",
              message: "Successfully Appointed ",
            });
            
          
        } else {
          return res.status(404).json({
            status_code: "2",
            status: "failed",
            message: " territory required",
          });
        }
      }else{
        console.log('coming in else part ')
        await connection.query(
          `
            UPDATE staff_data
            SET joining_date = ?, mapping = ?, salary = ?, approve_by = ?, shifts_id = ?, office_mobile = ?, office_email = ?, status = '1'
            WHERE application_id = ?
          `,
          [
            joiningDate,
            managerId,
            Salary,
            approve_by,
            shifts_id,
            office_mobile,
            office_email,
            applicationId,
          ]
        );

        await smsapi(
          "admin",
          "appoint",
          staff_data[0].mobile,
          staff_data[0].designation,
          staff_data[0].emp_id,
        );

        return res.status(200).json({
          status_code: "1",
          status: "success",
          message: "Successfully Appointed ",
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
      // Release the connection
      await connection.release();
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Internal server error",
    });
  }
});

router.post("/reject", requireAdminLogin, async (req, res) => {
  try {
    const { status_code, applicationId } = req.body;

    // Validate Input
    if (!applicationId || !status_code) {
      return res
        .status(400)
        .json({ status_code: "2", status: "failed", message: "Invalid input" });
    }

    // Validate Status Code
    if (!["3", "4", "5", "6"].includes(status_code)) {
      return res.status(400).json({
        status_code: "2",
        status: "failed",
        message: "Invalid status code or reason",
      });
    }

    // Prepare Response Message Based on Status Code
    const responseMessage = {
      3: "Staff rejected due to unclear working experience.",
      4: "Staff rejected due to unclear education information.",
      5: "Staff rejected due to unclear documents.",
      6: "Staff rejected due to personal information mismatch.",
    }[status_code];

    // Use promise-based connection
    const connection = await poolPromise().getConnection();

    try {
      const query = `
          UPDATE staff_data
          SET status = ?
          WHERE application_id = ?
          `;
      await connection.query(query, [status_code, applicationId]);

      // Return Response
      res.json({
        status_code: "1",
        status: "success",
        message: responseMessage,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        status_code: "2",
        status: "failed",
        message: "Internal server error",
      });
    } finally {
      // Release the connection
      await connection.release();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Internal server error",
    });
  }
});

router.post("/-Staff", requireAdminLogin, async (req, res) => {
  try {
    const { department, page = 1, limited = 10 } = req.body;
    console.log(page, limited);

    // Use promise-based connection
    const connection = await poolPromise().getConnection();

    try {
      const query = `
        SELECT designation, application_id, emp_id AS employee_id, name, mobile AS mobile_no, joining_date, profile_photo, type
        FROM staff_data
        WHERE status IN ("1", "0")
        ${department ? `AND department = ?` : ""}
        LIMIT ? OFFSET ?
      `;
      const rows = await connection.query(query, [
        department,
        limited,
        (page - 1) * limited,
      ]);

      // Format Response Data
      const responseData = {
        status_code: "1",
        status: "success",
        data: rows[0].map((row) => ({
          designation: row.designation,
          application_id: row.application_id,
          employee_id: row.employee_id,
          name: row.name,
          mobile_no: row.mobile_no,
          joining_date: row.joining_date
            ? row.joining_date.toISOString().slice(0, 10)
            : null,
          profile_photo: row.profile_photo,
          type: row.type,
        })),
      };

      // Return Response
      res.json(responseData);
    } catch (error) {
      console.error(error);
      res.status(500).json({
        status_code: "2",
        status: "failed",
        message: "Internal server error",
      });
    } finally {
      // Release the connection
      await connection.release();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Internal server error",
    });
  }
});

//Admin Finance Management start
router.post("/users", requireAdminLogin, async (req, res) => {
  const connection = await poolPromise().getConnection();
  const connection2 = await poolPromise2().getConnection();

  try {
    const { user_type, page = 1, limit = 25 } = req.body;
    let userData;

    switch (user_type) {
      case "Distributor":
        [userData] = await connection.query(
          "SELECT unique_id, customer_id, mobile_number, status FROM login WHERE user_type = ? LIMIT ? OFFSET ?",
          [user_type, limit, (page - 1) * limit]
        );
        break;
      case "FSE":
        [userData] = await connection.query(
          "SELECT unique_id, agent_id, name, mobile_number, status FROM fse LIMIT ? OFFSET ?",
          [limit, (page - 1) * limit]
        );
        break;
      case "CSP":
      case "Retailer":
      case "Merchant":
      case "User":
        [userData] = await connection2.query(
          "SELECT unique_id, mobile, package_id, package_expiry, status FROM auths WHERE user_type = ? LIMIT ? OFFSET ?",
          [user_type, limit, (page - 1) * limit]
        );
        break;
      default:
        return res.status(400).json({
          status_code: "2",
          status: "failed",
          message: "Invalid user type",
        });
    }

    return res.status(200).json({
      status_code: "1",
      status: "success",
      data: userData,
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

router.post("/user-details", requireAdminLogin, async (req, res) => {
  const connection = await poolPromise2().getConnection();

  try {
    const { unique_id } = req.body;

    // Fetch retailer data based on the unique_id
    const [retailerData] = await connection.query(
      "SELECT * FROM retailer WHERE unique_id = ?",
      [unique_id]
    );

    if (retailerData.length === 0) {
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message: "Retailer not found",
      });
    }

    // Send response with retailer details
    return res.status(200).json({
      status_code: "1",
      status: "success",
      data: retailerData[0],
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

router.get("/balance", requireAdminLogin, async (req, res) => {
  const connection = await poolPromise2().getConnection();

  try {
    const { unique_id } = req.admin;

    // Fetch balance data based on the unique_id
    const [balanceData] = await connection.query(
      "SELECT pool, wallet, gst FROM admin_wallets WHERE unique_id = ?",
      [unique_id]
    );

    if (balanceData.length === 0) {
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message: "Balance data not found",
      });
    }

    // Send response with balance details
    return res.status(200).json({
      status_code: "1",
      status: "success",
      data: balanceData,
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

router.post("/deposit", requireAdminLogin, async (req, res) => {
  try {
    const { amount ,remark} = req.body;
    const unique_id = await req.admin.unique_id;

    if (!amount) {
      return res.status(400).json({
        status_code: "2",
        status: "Failed",
        message: "Missing required fields",
      });
    }

    const connection = await poolPromise2().getConnection();

    try {
      const [adminBalance] = await connection.query(
        "SELECT pool as balance FROM admin_wallets WHERE unique_id = ?",
        [unique_id]
      );

      const opening_balance =
        adminBalance.length > 0 ? adminBalance[0].balance : 0;
      const closing_balance = opening_balance + parseInt(amount);

      const [maxTranIdResult] = await connection.query(
        "SELECT MAX(`tran_id`) as max_tran_id FROM admin_wallet_summarys"
      );

      const tran_id = maxTranIdResult[0].max_tran_id || 0;

      const transaction = {
        tran_id: tran_id + 1,
        unique_id: unique_id,
        amount: amount,
        ac_type: "pool",
        type: "CR",
        clo_bal: closing_balance,
        description: `Deposited Rs.${amount}/- ${remark}`,
        status: "success",
        transaction_at :new Date(),
      };

      await connection.query(
        "INSERT INTO admin_wallet_summarys SET ?",
        transaction
      );

      await connection.query(
        `UPDATE admin_wallets SET pool = ? WHERE unique_id = ?`,
        [closing_balance, unique_id]
      );

      res.status(200).json({
        status_code: "1",
        status: "success",
        "Current balance": closing_balance,
        message: "Transaction successful",
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        status_code: "2",
        status: "Failed",
        message: "Internal server error",
      });
    } finally {
      await connection.release();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status_code: "2",
      status: "Failed",
      message: "Internal server error",
    });
  }
});

router.post("/purchase", requireAdminLogin, async (req, res) => {
  try {
    const { amount ,remark} = req.body;
    const unique_id = await req.admin.unique_id;

    if (!amount) {
      return res.status(400).json({
        status_code: "2",
        status: "Failed",
        message: "Missing required fields",
      });
    }

    const connection = await poolPromise2().getConnection();

    try {
      const [poolBalanceResult] = await connection.query(
        "SELECT pool as balance FROM admin_wallets WHERE unique_id = ?",
        [unique_id]
      );

      const poolBalance =
        poolBalanceResult.length > 0 ? poolBalanceResult[0].balance : 0;

      if (amount > poolBalance) {
        return res.status(400).json({
          status_code: "2",
          status: "Failed",
          message: "Insufficient balance in the pool account",
        });
      }

      const closing_balance = poolBalance - amount;

      const [[walletAsWallet]] = await connection.query(
        "SELECT wallet FROM admin_wallets WHERE unique_id = ?",
        [unique_id]
      );

      console.log('wallet previos data',walletAsWallet.wallet)

      let walletAmount = parseFloat(walletAsWallet.wallet)+parseFloat(amount)

      // Debit the requested amount from the pool account
      await connection.query(
        "UPDATE admin_wallets SET pool = ? , wallet = ? WHERE unique_id = ?",
        [closing_balance,walletAmount, unique_id]
      );

      // Credit the amount to the wallet account
      const [maxTranIdResult] = await connection.query(
        "SELECT MAX(`tran_id`) as max_tran_id FROM admin_wallet_summarys"
      );
      console.log('wallet summary tranx id ',maxTranIdResult)

      const tran_id = maxTranIdResult[0].max_tran_id || 0;

      const descriptionPoolDebit = `Rs.${amount}/- is Successfully Transfer to ${remark}`;
      const ac_typePoolDebit = "Pool";

      await connection.query(
        "INSERT INTO admin_wallet_summarys (tran_id, unique_id, amount, ac_type, type, description, clo_bal,transaction_at,status) VALUES (?, ?, ?, ?, ?, ?, ?,?,?)",
        [
          tran_id + 1,
          unique_id,
          amount,
          ac_typePoolDebit,
          "DR",
          descriptionPoolDebit,
          closing_balance,
          new Date(),
          "Success"
        ]
      );

      const [walletBalanceResult] = await connection.query(
        "SELECT wallet as balance FROM admin_wallets WHERE unique_id = ?",
        [unique_id]
      );

      const walletBalance =
        walletBalanceResult.length > 0 ? walletBalanceResult[0].balance : 0;
      const current_wallet_balance = parseFloat(walletBalance) ;

      // Credit the amount to the wallet account
      const descriptionWalletCredit = `Rs.${amount}/- is Successfully Credit To ${remark}`;
      const ac_typeWalletCredit = "wallet";

      await connection.query(
        "INSERT INTO admin_wallet_summarys (tran_id, unique_id, amount, ac_type, type, description, clo_bal,transaction_at,status) VALUES (?, ?, ?, ?, ?, ?, ?,?,?)",
        [
          tran_id + 2,
          unique_id,
          amount,
          ac_typeWalletCredit,
          "CR",
          descriptionWalletCredit,
          current_wallet_balance,
          new Date(),
          "Success"
        ]
      );

      return res.status(200).json({
        status_code: "1",
        status: "success",
        "Current balance": closing_balance,
        message: "Purchase order successful",
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        status_code: "2",
        status: "Failed",
        message: "Internal server error",
      });
    } finally {
      await connection.release();
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status_code: "2",
      status: "Failed",
      message: "Internal server error",
    });
  }
});

router.post("/expend", requireAdminLogin, async (req, res) => {
  const connection = await poolPromise2().getConnection();
  const unique_id = await req.admin.unique_id;
  const { type, amount, remark } = req.body;

  try {
    // Validate if the type is valid (Pool or Wallet)
    if (type.toLowerCase() !== "pool" && type.toLowerCase() !== "wallet") {
      return res.status(422).json({
        status_code: "2",
        status: "failed",
        message: "Invalid wallet type.",
      });
    }

    // Fetch the current balance from the admin wallet based on the provided wallet type
    const [adminWallet] = await connection.query(
      "SELECT * FROM admin_wallets WHERE unique_id = ?",
      [unique_id]
    );

    if (adminWallet.length === 0) {
      return res.status(404).json({
        status_code: "2",
        status: "failed",
        message: "Admin wallet not found.",
      });
    }

    const currentBalance = adminWallet[0][type.toLowerCase()];

    // Check if the wallet has sufficient balance for the expenditure
    if (currentBalance < Number(amount)) {
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message: "Insufficient funds in the wallet.",
      });
    }

    // Calculate the new balance after the expenditure
    const newBalance = currentBalance - Number(amount);
    console.log('new balanace',newBalance)

    // Update the admin wallet with the new balance
    await connection.query(
      `UPDATE admin_wallets SET ${type.toLowerCase()} = ? WHERE unique_id = ?`,
      [newBalance, unique_id]
    );

    // Fetch the last tran_id from admin_wallet_summarys
    const [lastTranIdResult] = await connection.query(
      "SELECT MAX(tran_id) AS lastTranId FROM admin_wallet_summarys WHERE unique_id = ?",
      [unique_id]
    );

    const lastTranId = lastTranIdResult[0].lastTranId || 10000;

    // Insert the expenditure record into the admin wallet summary
    await connection.query(
      "INSERT INTO admin_wallet_summarys (unique_id, tran_id, transaction_at, ac_type, type, description, amount, clo_bal, status) VALUES (?, ?, CURRENT_TIMESTAMP(), ?, ?, ?, ?, ?, ?)",
      [
        unique_id,
        lastTranId + 1,
        type,
        "DR",
        ` ${remark} + Surcharge Rs. + ${amount}/- Debit in ${type}`,
        Number(amount),
        newBalance,
        "Success",
      ]
    );

    return res.status(200).json({
      status_code: "1",
      status: "success",
      message: "Expenditure successfully updated. Closing balance updated.",
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

router.get("/-balance/:user_type", requireAdminLogin, async (req, res) => {
  const connection = await poolPromise2().getConnection();

  try {
    const { user_type } = req.params;
    let query;

    console.log('user_type user -balane by unique id ',user_type);

    // Check user_type and  data accordingly
    if (user_type.toLowerCase() === "all") {
      query = "SELECT * FROM wallets";
    } else {
      query = "SELECT * FROM wallets WHERE user_type = ?";
    }

    const [userBalanceData] = await connection.query(query, [user_type]);

    if (userBalanceData.length === 0) {
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message: "User balance data not found",
      });
    }

    // Send response with user balance details
    return res.status(200).json({
      status_code: "1",
      status: "success",
      data: userBalanceData.map((userData) => ({
        unique_id: userData.unique_id,
        customer_id: userData.customer_id,
        wallet: userData.wallet,
        hold: userData.hold,
        unsettle: userData.unsettle,
        status: userData.status,
      })),
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

router.get("/user-balance/:unique_id", requireAdminLogin, async (req, res) => {
  const connection = await poolPromise2().getConnection();

  try {
    const { unique_id } = req.params;

    console.log('uniqe id getting in params in router ',unique_id)

    // Fetch user balance data based on the unique_id
    const [userData] = await connection.query(
      "SELECT * FROM wallets WHERE unique_id = ?",
      [unique_id]
    );

    if (userData.length === 0) {
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message: "User balance data not found",
      });
    }

    // Send response with user balance details
    return res.status(200).json({
      status_code: "1",
      status: "success",
      data: {
        user_type: userData[0].user_type,
        wallet: userData[0].wallet,
        hold: userData[0].hold,
        unsettle: userData[0].unsettle,
        status: userData[0].status,
      },
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

router.post("/transfer", requireAdminLogin, async (req, res) => {
  const connection = await poolPromise2().getConnection();

  try {
    const { unique_id, type, amount, remark } = req.body;
    const admin_unique_id = req.admin.unique_id;
    // Check if the user has sufficient balance for DR

    // dr ka case
    // title = debited Rs ${var} 
    // message = Successfully Debited Rs ${var} ${remark}

    var title, message;

    if (type === "DR") {
      const [userData] = await connection.query(
        "SELECT wallet FROM wallets WHERE unique_id = ?",
        [unique_id]
      );

      const [adminData] = await connection.query(
        "SELECT wallet FROM admin_wallets WHERE unique_id = ?",
        [admin_unique_id]
      );
      console.log(adminData);
     
      if (userData.length === 0) {
        return res.status(200).json({
          status_code: "2",
          status: "failed",
          message: "Invalid User Wallet",
        });
      }
      if (userData[0].wallet < amount) {
        // Insufficient balance or user not found
        await connection.query(
          "UPDATE wallets SET hold = hold + ? WHERE unique_id = ?",
          [amount, unique_id]
        );
        return res.status(200).json({
          status_code: "2",
          status: "failed",
          message:
            "Insufficient Fund in User Wallet. update in hold book/wallet.",
        });
      }

      // Debit from User Wallet and Credit to Admin Wallet
      await connection.beginTransaction();

      // Debit from User Wallet
      await connection.query(
        "UPDATE wallets SET wallet = wallet - ? WHERE unique_id = ?",
        [amount, unique_id]
      );

      // Credit to Admin Wallet
      await connection.query(
        "UPDATE admin_wallets SET wallet = wallet + ? WHERE unique_id = ?",
        [+amount, admin_unique_id]
      );
     
      // Insert into admin_wallet_summarys
      const [lastTranId] = await connection.query(
        "SELECT MAX(tran_id) AS maxTranId FROM admin_wallet_summarys"
      );
      const newTranId = lastTranId[0].maxTranId + 1;

      await connection.query(
        "INSERT INTO admin_wallet_summarys (unique_id, tran_id, transaction_at, ac_type, type, description, amount, clo_bal, status) VALUES (?, ?, CURRENT_TIMESTAMP(), ?, ?, ?, ?, ?, ?)",
        [
          admin_unique_id,
          newTranId,
          "Wallet",
          "CR",
          ` ₹. + ${amount}/- ${remark} Surcharge `,
          amount,
          adminData[0].wallet + Number(amount),
          "Success",
        ]
      );

      const [lastTranIdd] = await connection.query(
        "SELECT MAX(tran_id) AS maxTranId FROM walletsummarys"
      );
      const newTranIdd = lastTranIdd[0].maxTranId + 1;
      // Insert into walletsummary
      await connection.query(
        "INSERT INTO walletsummarys (tran_id, tran_at, unique_id, description, type, amount, closing_balance, status) VALUES (?, CURRENT_TIMESTAMP(), ?, ?, ?, ?, ?, ?)",
        [
          newTranIdd,
          unique_id,
          `₹. + ${amount}/- ${remark} Surcharge`,
          "DR",
          amount,
          userData[0].wallet - Number(amount),
          "Success",
        ]
      );
   

      const [[fcm_token]]= await connection.query(
        "SELECT fcm_token FROM auths where unique_id =?",
        [unique_id]
      );
      console.log('fcm token is here',fcm_token);

      if(fcm_token && fcm_token.fcm_token ){

        let fcm_arr = [fcm_token.fcm_token]
        console.log('fcm token arr',fcm_arr)

     title = `Debited Rs ${amount}`; 
     message = `Successfully Debited Rs ${amount} ${remark}`
 
    let result = await sendPushNotification(message, fcm_arr, title);
    console.log('fcm result is here',result);

    const randomFiveDigitNumber = Math.floor(Math.random() * 90000) + 10000;

    await connection.query(
      "INSERT INTO notification (`from`, `to`, notify_id, title, message) VALUES (?, ?, ?, ?, ?)",
      [
        "Auto",
        unique_id,
        randomFiveDigitNumber,
        title,
        message,
      ]
    );

   
      await connection.commit();

    return res.status(200).json({
      status_code: "1",
      status: "success",
      message: "Transfer successful",
      fcmMessage : 'Push Notification send successfully'
    });

    }

      await connection.commit();

      return res.status(200).json({
        status_code: "1",
        status: "success",
        message: "Transfer successful",
        fcmMessage :'push notification not send fcm token not found in auth table for this user'
      });
    } else if (type === "CR") {
      // Check if Admin has sufficient balance
      const [adminData] = await connection.query(
        "SELECT wallet FROM admin_wallets WHERE unique_id = ?",
        [admin_unique_id]
      );

      const [userData] = await connection.query(
        "SELECT wallet FROM wallets WHERE unique_id = ?",
        [unique_id]
      );

      if (adminData.length === 0 || adminData[0].wallet < amount) {
        // Insufficient balance or admin not found
        return res.status(200).json({
          status_code: "2",
          status: "failed",
          message: "Insufficient Fund in Admin Wallet",
        });
      }

      // Debit from Admin Wallet and Credit to User Wallet
      await connection.beginTransaction();

      // Debit from Admin Wallet
      await connection.query(
        "UPDATE admin_wallets SET wallet = wallet - ? WHERE unique_id = ?",
        [amount,  admin_unique_id]
      );

      // Credit to User Wallet
      await connection.query(
        "UPDATE wallets SET wallet = wallet + ? WHERE unique_id = ?",
        [amount, unique_id]
      );

      // Insert into admin_wallet_summarys
      const [lastTranId] = await connection.query(
        "SELECT MAX(tran_id) AS maxTranId FROM admin_wallet_summarys"
      );
      const newTranId = lastTranId[0].maxTranId + 1;

      await connection.query(
        "INSERT INTO admin_wallet_summarys (unique_id, tran_id, transaction_at, ac_type, type, description, amount, clo_bal, status) VALUES (?, ?, CURRENT_TIMESTAMP(), ?, ?, ?, ?, ?, ?)",
        [
          admin_unique_id,
          newTranId,
          "Wallet",
          "DR",
          ` ${remark} + Surcharge Rs. + ${amount}/- `,
          amount,
          adminData[0].wallet - Number(amount),
          "Success",
        ]
      );

      const [lastTranIdd] = await connection.query(
        "SELECT MAX(tran_id) AS maxTranId FROM walletsummarys"
      );
      const newTranIdd = lastTranIdd[0].maxTranId + 1;
      // Insert into walletsummary
      await connection.query(
        "INSERT INTO walletsummarys (tran_id, tran_at, unique_id, description, type, amount, closing_balance, status) VALUES (?, CURRENT_TIMESTAMP(), ?, ?, ?, ?, ?, ?)",
        [
          newTranIdd,
          unique_id,
          ` ${remark} + Surcharge Rs. + ${amount}/-`,
          "CR",
          amount,
          userData[0].wallet + Number(amount),
          "Success",
        ]
      );



      const [[fcm_token]]= await connection.query(
        "SELECT fcm_token FROM auths where unique_id =?",
        [unique_id]
      );
      console.log('fcm token is here',fcm_token);

    
       
      if(fcm_token && fcm_token.fcm_token ){

        let fcm_arr = [fcm_token.fcm_token]
        console.log('fcm token arr',fcm_arr)

      title = `Credited Rs ${amount}`; 
      message = `Successfully Credited Rs ${amount} ${remark}`
  
     let result = await sendPushNotification(message, fcm_arr, title);
     console.log('fcm result is here',result);
 
     const randomFiveDigitNumber = Math.floor(Math.random() * 90000) + 10000;
 
     await connection.query(
       "INSERT INTO notification (`from`, `to`, notify_id, title, message) VALUES (?, ?, ?, ?, ?)",
       [
         "Auto",
         unique_id,
         randomFiveDigitNumber,
         title,
         message,
       ]
     );

     await connection.commit();

     return res.status(200).json({
      status_code: "1",
      status: "success",
      message: "Transfer successful",
      fcmMessage : "push notification send successfully "
    });

      }

      await connection.commit();

      return res.status(200).json({
        status_code: "1",
        status: "success",
        message: "Transfer successful",
        fcmMessage : "push notification not send successfully fcm token not found in auth table "
      });
    } else {
      // Invalid transfer type
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message: "Invalid transfer type",
      });
    }
  } catch (error) {
    console.error(error);
    await connection.rollback();
    return res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Internal Server Error",
    });
  } finally {
    await connection.release();
  }
});

router.get("/evalue", requireAdminLogin, async (req, res) => {
  const connection = await poolPromise2().getConnection();

  try {
    // Fetch specific fields from the evalue table
    const [evalueData] = await connection.query(
      `SELECT DATE_FORMAT(request_at, "%Y-%m-%d %H:%i:%s") AS request_at,date, order_id, amount, mode_of_payment,date, bank_ref_num,status FROM evalues ORDER BY request_at DESC`,
      []
    );

    if(evalueData.length>0){

      const pendingRequest = evalueData.map(row => {
        // Extracting only the date part from the timestamp
        const date = new Date(row.date).toISOString().split('T')[0];
        return { ...row, date };
    });

    return res.status(200).json({
      status_code: "1",
      status: "success",
      data: pendingRequest,
    });
  }else{
    return res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "No data found",
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

router.get("/request-evalue", requireAdminLogin, async (req, res) => {
  const connection = await poolPromise2().getConnection();

  try {
    // Fetch pending evalue requests
    const [pendingRequests] = await connection.query(
      'SELECT DATE_FORMAT(request_at, "%Y-%m-%d %H:%i:%s") AS request_at, order_id, date, amount, mode_of_payment, bank_ref_num FROM evalues WHERE status = "Pending"'
    );

    if (pendingRequests.length > 0) {
      const pendingRequest = pendingRequests.map(row => {
        // Extracting only the date part from the timestamp
        const date = new Date(row.date).toISOString().split('T')[0];
        return { ...row, date };
    });
      // If pending requests found
      return res.status(200).json({
        status_code: "1",
        status: "success",
        data: pendingRequest,
      });
    } else {
      // If no pending requests found
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message: "Not Available",
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

router.get("/view-details/:order_id", requireAdminLogin, async (req, res) => {
  const connection = await poolPromise2().getConnection();
  const connection2 = await poolPromise().getConnection();
  const { order_id } = req.params; // Use req.params to get the order_id

  try {
    // Fetch E-value details by order ID
    const [evalueDetails] = await connection.query(
      "SELECT request_at, order_id, unique_id, deposited, date, amount, mode_of_payment, bank_ref_num, approved_by, approve_at, remark, status , receipt FROM evalues WHERE order_id = ?",
      [order_id]
    );

    if (evalueDetails.length > 0)
    {
      const savedData = await connection2.query(
        "SELECT name FROM staff_data WHERE unique_id = ?",
        [evalueDetails[0].unique_id] 
      );
     
      const details = { name: savedData[0][0].name, ...evalueDetails[0]};
      
      return res.status(200).json({
        status_code: "1",
        status: "success",
        data: details,
      });
    } else {
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message: "E-value details not found for the specified order ID",
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

router.get("/view-receipt/:order_id", requireAdminLogin, async (req, res) => {
  const connection = await poolPromise2().getConnection();
  const { order_id } = req.params; // Use req.params to get the order_id

  try {
    // Fetch receipt by order ID
    const [evalueDetails] = await connection.query(
      "SELECT receipt FROM evalue WHERE order_id = ?",
      [order_id]
    );

    if (evalueDetails.length > 0) {
      return res.status(200).json({
        status_code: "1",
        status: "success",
        receipt: evalueDetails[0].receipt,
      });
    } else {
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message: "Receipt not found for the specified order ID",
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

router.post("/evalue-update", requireAdminLogin, async (req, res) => {
  try {
    const { status, order_id, remark } = req.body; // status will be  0 or 1
    const admin_unique_id = req.admin.unique_id;
    const name = req.admin.name;

    console.log(status, order_id);

    const status_list = ["Reject", "Approved"];

    if (status != 0 && status != 1) {
      return res.status(200).json({
        status_code: "2",
        status: "Failed",
        message: "Status either 0 for Reject or 1 for Approval",
      });
    } else {
      const connection = await poolPromise2().getConnection();
      const connection2 = await poolPromise().getConnection();

      //

      try {
        const [evalueResult] = await connection.query(
          "SELECT request_at, amount, status, unique_id,mode_of_payment,bank_ref_num,deposited, order_id FROM evalues WHERE order_id = ?",
          [order_id]
        );

        if (evalueResult.length === 0) {
          return res.status(200).json({
            status_code: "2",
            status: "Failed",
            message: "No data found in evalue table for the specified order_id",
          });
        }

        const evalueRecord = evalueResult[0];

        if (
          evalueRecord.status === "Pending" ||
          evalueRecord.status === "pending"
        ) {
          const [adminWalletResult] = await connection.query(
            "SELECT wallet,pool FROM admin_wallets WHERE unique_id = ?",
            [admin_unique_id]
          );

          const adminWalletBalance =
            adminWalletResult.length > 0 ? adminWalletResult[0].wallet : 0;

          if (adminWalletBalance < evalueRecord.amount) {
            return res.status(200).json({
              status_code: "2",
              status: "Failed",
              message: "Due to Low Balance in Admin Wallet",
            });
          }
 

          // if status is 0 then this will run 
          if (status == 0) {
            await connection.query(
              "UPDATE evalues SET status=? WHERE order_id=?",
              [status_list[status], order_id]
            );

            return res.status(200).json({
              status_code: "2",
              status: "Failed",
              message: `Request Successfully ${status_list[status]}`,
            });
          } else {
            const [maxTranIdResult] = await connection.query(
              "SELECT MAX(tran_id) FROM admin_wallet_summarys"
            );

            const tran_id = maxTranIdResult[0]["MAX(tran_id)"] || 10000;

           

            const adminpoolBalance =
            adminWalletResult.length > 0 ? adminWalletResult[0].pool : 0;

            console.log('evlaue - update',
            adminpoolBalance + evalueRecord.amount,
              adminWalletBalance - evalueRecord.amount,
            )

            const updateAdminWalletResult = await connection.query(
              "UPDATE admin_wallets SET pool = ?, wallet = ? WHERE unique_id = ?",
              [
                parseFloat(adminpoolBalance) + parseFloat(evalueRecord.amount),
                parseFloat(adminWalletBalance) - parseFloat(evalueRecord.amount),
                admin_unique_id,
              ]
            );

            console.log('admin update reuslt ',updateAdminWalletResult)

            // await connection.query(
            //   "UPDATE evalues SET status=?, approved_by=? WHERE order_id=?",
            //   [status_list[status], name, order_id]
            // );


            //getting user name from user auth table 
              // return res.json({Id:evalueRecord.unique_id})
            const [wallet] = await connection.query("SELECT * FROM wallets WHERE unique_id = ?", [evalueRecord.unique_id]);
            let userName = null;
            if (wallet[0].user_type === "Distributor")
            {
              const [result_value] = await connection2.query("SELECT name FROM distributor WHERE unique_id = ?",[evalueRecord.unique_id])
              if (result_value.length !== 0)
              {
               
                userName = [{}];
                userName[0].authorized_person_name = result_value[0].name               
              }
            }
            else if (wallet[0].user_type === "Merchant" || (wallet[0].user_type === "Merchant"))
            {
                [userName] = await connection.query(
                "SELECT authorized_person_name FROM merchants Where unique_id = ?",
                [evalueRecord.unique_id]
              );
            }
            
            
             
              
            
            
            console.log('wallet_sumjary record', adminWalletBalance + evalueRecord.amount,)
            console.log(`User ${userName[0].authorized_person_name} Transfered Rupees ${evalueRecord.amount} Via Payment Method ${evalueRecord.mode_of_payment} Bank Refrence Name is ${evalueRecord.bank_ref_num} into Bank ${evalueRecord.deposited}`)
           
 
            const cloBalForMaxId =
            adminWalletResult.length > 0 ? parseFloat(adminWalletResult[0].pool) : 0;

            console.log('maxIdForLastClosingBalance ',cloBalForMaxId)

            //for pool changes entry 
            await connection.query(
              "INSERT INTO admin_wallet_summarys (tran_id, unique_id, ac_type, type, amount, description, clo_bal, status,transaction_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?,?)",
              [
                tran_id + 1,
                admin_unique_id,
                "Pool",
                "CR",
                evalueRecord.amount,
                `${userName[0].authorized_person_name}  ${evalueRecord.mode_of_payment} Rs ${evalueRecord.amount}   Ref No. ${evalueRecord.bank_ref_num} deposited into ${evalueRecord.deposited}`,
                cloBalForMaxId+ parseFloat(evalueRecord.amount),
                "Success",
                new Date()
              ]
            );


            const [maxTranIdResultWAllet] = await connection.query(
              "SELECT MAX(tran_id) FROM admin_wallet_summarys"
            );
            const tran_idWallet = maxTranIdResultWAllet[0]["MAX(tran_id)"] || 10000;

            const cloBalForMaxIdWallet =
            adminWalletResult.length > 0 ? parseFloat(adminWalletResult[0].wallet) : 0;

            // const cloBalForMaxIdWallet = parseFloat(maxIdAndCloBalWallet[0].clo_bal);
            //for walllet changes entry 
            await connection.query(
              "INSERT INTO admin_wallet_summarys (tran_id, unique_id, ac_type,transaction_at, type, amount, description, clo_bal, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?,?)",
              [
                tran_idWallet + 1,
                admin_unique_id,
                "Wallet",
                new Date().toISOString().slice(0, 19).replace('T', ' '),
                "DR",
                evalueRecord.amount,
                `Evalue Approved Rs. ${evalueRecord.amount} | Order ID: ${evalueRecord.order_id} For ${userName[0].authorized_person_name} `,      
                cloBalForMaxIdWallet - parseFloat(evalueRecord.amount),
                "Success"
              ]
            );

            //update latest time 
            await connection.query(
              "UPDATE evalues SET approve_at = ? WHERE order_id=?",
              [new Date(), order_id]
            );

            const [maxTranIdTwoResult] = await connection.query(
              "SELECT MAX(tran_id) FROM walletsummarys"
            );

            const tran_id_two = maxTranIdTwoResult[0]["MAX(tran_id)"] || 10000;

            const [walletResult] = await connection.query(
              "SELECT wallet FROM wallets WHERE unique_id=?",
              [evalueRecord.unique_id]
            );

            await connection.query(
              "UPDATE wallets SET wallet=? WHERE unique_id=?",
              [
                walletResult[0].wallet + evalueRecord.amount,
                evalueRecord.unique_id,
              ]
            );

            await connection.query(
              "INSERT INTO walletsummarys (tran_id, unique_id, type, amount, status, description, closing_balance) VALUES (?, ?, ?, ?, ?, ?, ?)",
              [
                tran_id_two + 1,
                evalueRecord.unique_id,
                "CR",
                evalueRecord.amount,
                "Success",
                // `Evalue Approved Rs ${evalueRecord.amount}/- Credit in Your Wallet`,
                `Evalue Approved Rs ${evalueRecord.amount}/- ${order_id}:Credit in Your Wallet`,
                // `Rs ${evalueRecord.amount}/- Credit in Your Wallet Transfer By ${name}`,
                walletResult[0].wallet + evalueRecord.amount,
              ]
            );

            // return res.json({user})


            // find fcm from auth table
            const [[fcm_token]]= await connection.query(
              "SELECT fcm_token FROM auths where unique_id =?",
              [evalueRecord.unique_id]
            );
            console.log('fcm token is here',fcm_token);

            
             
            if (fcm_token && fcm_token.fcm_token)
            {
              let fcm_arr = [fcm_token.fcm_token]
            console.log('fcm token arr',fcm_arr)
             let title = `Rs ${evalueRecord.amount} Approved`
             let message = `Evalue Approved Rs ${evalueRecord.amount}/- Order ID: ${order_id} Credit in Your Wallet`
            //send push notification's
            let result = await sendPushNotification(message, fcm_arr, title);
            console.log('fcm result is here',result);

            const randomFiveDigitNumber = Math.floor(Math.random() * 90000) + 10000;

            await connection.query(
              "INSERT INTO notification (`from`, `to`, notify_id, title, message) VALUES (?, ?, ?, ?, ?)",
              [
                "Auto",
                evalueRecord.unique_id,
                randomFiveDigitNumber,
                title,
                message,
              ]
            );
            

            return res.status(200).json({
              status_code: "1",
              status: "success",
              message: `Request Successfully ${status_list[status]}`,
              exchange: {
                amount: evalueRecord.amount,
                before: {
                  admin_wallet_balance: adminWalletBalance,
                  user_wallet_balance: walletResult[0].wallet,
                },
                after: {
                  admin_wallet_balance:
                    adminWalletBalance - evalueRecord.amount,
                  user_wallet_balance:
                    walletResult[0].wallet + evalueRecord.amount,
                },
                "FcmMessage":'push notification send successfully'
              },
            });
        }
            return res.status(200).json({
              status_code: "1",
              status: "success",
              message: `Request Successfully ${status_list[status]}`,
              exchange: {
                amount: evalueRecord.amount,
                before: {
                  admin_wallet_balance: adminWalletBalance,
                  user_wallet_balance: walletResult[0].wallet,
                },
                after: {
                  admin_wallet_balance:
                    adminWalletBalance - evalueRecord.amount,
                  user_wallet_balance:
                    walletResult[0].wallet + evalueRecord.amount,
                },
                "FcmMessage":'fcm token is not found in auth table'
              },
            });
          }
        } else if (
          evalueRecord.status === "Approved" ||
          evalueRecord.status === "approved"
        ) {
          return res.status(200).json({
            status_code: "2",
            status: "Failed",
            message: "Request Already Approved",
          });
        } else {
          return res.status(200).json({
            status_code: "2",
            status: "failed",
            message: "Request Already Rejected",
          });
        }
      } catch (error) {
        console.error(error);
        return res.status(500).json({
          status_code: "2",
          status: "failed",
          message: "Something went wrong!" + error,
        });
      } finally {
        await connection.release();
      }
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Something went wrong!" + error,
    });
  }
});


router.post("/wallet-summary", requireAdminLogin, async (req, res) => {
  const connection = await poolPromise2().getConnection();

  const { wallet, fromDate, toDate, page = 1, limit = 25 } = req.body;

  try {
    // Calculate the offset based on page and limit for pagination
    const offset = (page - 1) * limit;

    const [walletSummaryData] = await connection.query(
    "SELECT id, unique_id, tran_id, ac_type, transaction_at, type, amount, status, description, clo_bal FROM admin_wallet_summarys WHERE ac_type = ? AND transaction_at BETWEEN ? AND ? LIMIT ? OFFSET ?",
    [wallet, fromDate + " 00:00:00", toDate + " 23:59:59", parseInt(limit), parseInt(offset)]
);


    if(walletSummaryData.length>0){
    return res.status(200).json({
      status_code: "1",
      status: "success",
      data: walletSummaryData,
    });
  }else{
    return res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "no history found in between these two dates",
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

router.post("/user-wallet-summary", requireAdminLogin, async (req, res) => {
  const connection = await poolPromise2().getConnection();

  let { unique_id, fromDate, toDate, page , limit} = req.body;

  try {
    // Calculate the offset based on page and limit for pagination
   limit = Number(limit)
    let offset = (page - 1) * limit;
    offset = Number(offset)

    // Fetch user wallet summary data based on the provided parameters and pagination    
    const [walletSummaryData] = await connection.query(
      "SELECT id, unique_id, tran_id,description, type, amount,closing_balance FROM walletsummarys WHERE unique_id = ? AND tran_at BETWEEN ? AND ? LIMIT ? OFFSET ?",
      [unique_id, fromDate + " 00:00:00", toDate + " 23:59:59", parseInt(limit), parseInt(offset)]
  );    

    return res.status(200).json({
      status_code: "1",
      status: "success",
      dataLength: walletSummaryData.length,
      data: walletSummaryData,
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

router.get("/get-voucher", requireAdminLogin, async (req, res) => {
  try {
    const connection = await poolPromise2().getConnection();
    try {
      const [voucherResult] = await connection.query("SELECT * FROM voucher ");

      return res.status(200).json({
        status_code: "1",
        status: "Success",
        data: voucherResult,
      });
    } catch (error) {
      console.error(error);
      return res.status(200).json({
        status_code: "2",
        status: "Failed",
        error: "Something went wrong!",
      });
    } finally {
      await connection.release();
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status_code: "2",
      status: "Failed",
      message: "Internal server error",
    });
  }
});

// missing user table for "Redeem" info
router.post("/voucher-redeem-info", requireAdminLogin, async (req, res) => {
  try {
    const { voucher_id } = req.body;
    const connection = await poolPromise2().getConnection();

    try {
      const [voucherResult] = await connection.query(
        "SELECT customer_id, redeem_at, voucher_id, voucher_code, amount, status, expiry FROM voucher WHERE voucher_id = ?",
        [voucher_id]
      );

      if (voucherResult[0].status === "Active") {
        if (voucherResult[0].expiry < Date.now()) {
          await connection.query(
            "UPDATE voucher SET status = ?, amount = ? WHERE voucher_id = ?",
            ["Expired", 0, voucher_id]
          );

          await connection.query(
            "UPDATE admin_wallets SET wallet = wallet + ?",
            [voucherResult[0].amount]
          );

          return res.status(200).json({
            status_code: "1",
            status: "Expire",
            message: "Successfully Credit to Admin Wallet",
          });
        } else {
          return res.status(200).json({
            status_code: "1",
            status: "Active",
            message: "Nobody Redeem this Voucher",
          });
        }
      } else if (voucherResult[0].status === "Redeem") {
        const [usersResult] = await connection.query(
          "SELECT customer_id, name, user_type FROM login_data WHERE customer_id = ?",
          [voucherResult[0].customer_id]
        );

        return res.status(200).json({
          status_code: "1",
          status: "Redeem",
          customer_id: usersResult[0].customer_id,
          customer_name: usersResult[0].name,
          customer_type: usersResult[0].user_type,
          redeem_at: voucherResult[0].redeem_at,
          amount: voucherResult[0].amount,
        });
      } else {
        return res.status(200).json({
          status_code: "1",
          status: "Expire",
          message: "VOUCHER IS EXPIRED",
        });
      }
    } catch (error) {
      console.error(error);
      return res.status(200).json({
        status_code: "2",
        status: "Failed",
        error: "Something went wrong!",
      });
    } finally {
      await connection.release();
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status_code: "2",
      status: "Failed",
      message: "Internal server error",
    });
  }
});

router.post("/generate-voucher", requireAdminLogin, async (req, res) => {
  try {
    const { amount, days, no_of_voucher } = req.body;

    const connection = await poolPromise2().getConnection();

    try {
      const [adminWalletResult] = await connection.query(
        "SELECT wallet FROM admin_wallets",
        []
      );

      if (adminWalletResult[0].wallet < amount * no_of_voucher) {
        return res.status(200).json({
          status_code: "2",
          status: "Failed",
          message: "Insufficient wallet balance",
          total_voucher_amount: amount * no_of_voucher,
          current_balance: adminWalletResult[0].wallet,
        });
      } else {
        const expiry = Date.now() + days * 100000000;

        const [maxVoucherIdResult] = await connection.query(
          "SELECT MAX(voucher_id) + 1 AS max_voucher_id FROM voucher",
          []
        );

        const voucherdata = [];
        const maxVoucherId = maxVoucherIdResult[0].max_voucher_id || 100000000;

        for (let i = 0; i < Number(no_of_voucher); i++) {
          const voucher_code = Math.floor(Math.random() * 1e16);
          const timestamp = new Date();
          const maxVoucherIdRes = Number(maxVoucherId) + i;
          voucherdata.push([
            timestamp,
            maxVoucherIdRes,
            voucher_code,
            expiry,
            amount,
            "Active",
          ]);
        }

        await connection.query(
          "INSERT INTO voucher (timestamp, voucher_id, voucher_code, expiry, amount, status) VALUES ? ",
          [voucherdata]
        );

        const [allVoucherResult] = await connection.query(
          "SELECT voucher_id, voucher_code, amount, expiry FROM voucher WHERE voucher_id BETWEEN ? AND ? ",
          [
            `${maxVoucherId}`,
            `${
              Number(maxVoucherIdResult[0].max_voucher_id) +
              Number(no_of_voucher)
            }`,
          ]
        );

        return res.status(200).json({
          status_code: "1",
          status: "success",
          data: allVoucherResult,
        });
      }
    } catch (error) {
      console.error(error);
      return res.status(200).json({
        status_code: "2",
        status: "Failed",
        error: "Something went wrong!" + error,
      });
    } finally {
      await connection.release();
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status_code: "2",
      status: "Failed",
      message: "Internal server error",
    });
  }
});

//Admin Finance Management end

// attendance start
router.get("/view-attendance-list/:date",requireAdminLogin,
  async (req, res) => {
    const connection = await poolPromise().getConnection();

    try {
      const { date } = req.params;

      // Fetch attendance data for the specified date with employee details
      const [attendanceData] = await connection.query(
        "SELECT a.id, a.unique_id, s.emp_id, s.name as emp_name, DATE_FORMAT(a.date, '%Y-%m-%d') as date, a.time, a.coordinates, a.status, a.type FROM attendance a INNER JOIN staff_data s ON a.unique_id = s.unique_id WHERE a.date = ?",
        [date]
      );

      if (attendanceData.length === 0) {
        return res.status(200).json({
          status_code: "02",
          status: "failed",
          message: "No attendance data available for the specified date",
        });
      }

      return res.status(200).json({
        status_code: "01",
        status: "success",
        data: attendanceData,
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
  }
);

router.post("/update-attendance", requireAdminLogin, async (req, res) => {
  const connection = await poolPromise().getConnection();

  try {
    const { status, remark, date, unique_id } = req.body; // status should be 'Reject','Approved'

    // Fetch pending attendance data for the specified date and unique_id
    const [pendingAttendance] = await connection.query(
      'SELECT * FROM attendance WHERE date = ? AND unique_id = ? AND status = "Pending"',
      [date, unique_id]
    );

    if (pendingAttendance.length === 0) {
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message:
          "No pending attendance data available for the specified date and unique_id",
      });
    }

    // Update status and remark for the pending attendance data
    await connection.beginTransaction();

    await connection.query(
      'UPDATE attendance SET status = ?, remark = ? WHERE date = ? AND unique_id = ? AND status = "Pending"',
      [status, remark, date, unique_id]
    );

    // Commit the transaction
    await connection.commit();

    return res.status(200).json({
      status_code: "1",
      status: "success",
      message: "Attendance updated successfully",
    });
  } catch (error) {
    console.error(error);
    await connection.rollback();
    return res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Internal Server Error",
    });
  } finally {
    await connection.release();
  }
});
// attendance end

//ticket start

router.post("/add-task", requireAdminLogin, async (req, res) => {
  const connection = await poolPromise().getConnection();

  try {
    const { send_to, message, subject } = req.body;

    const send_from = req.admin.mobile;
    // Generate a random 9-digit msg_id
    const msgId = Math.floor(100000000 + Math.random() * 900000000);

    // Insert data into work_report table
    await connection.query(
      "INSERT INTO work_report (send_from, send_to, messa_type, msg_id, subject, message, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [send_from, send_to, "new", msgId, subject, message, "New"]
    );

    return res.status(200).json({
      status_code: "02",
      status: "success",
      message: "Task added successfully",
      subject: subject,
      msg_id: msgId,
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

router.get("/view", requireAdminLogin, async (req, res) => {
  const connection = await poolPromise().getConnection();

  try {
    const userMobile = req.admin.mobile;

    // Fetch data from work_report table based on user email
    const [result] = await connection.query(
      "SELECT id, send_from, send_to, messa_type, msg_id, subject, message, status, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at FROM work_report WHERE (send_from = ? OR send_to = ?) AND status IN (?, ?) ORDER BY created_at ASC, id ASC",
      [userMobile, userMobile, "New", "Read"]
    );

    await connection.query(
      "UPDATE work_report SET status = ? WHERE (send_from = ? OR send_to = ?) AND status = 'New' ",
      ["Read", userMobile, userMobile]
    );

    return res.status(200).json({
      status_code: "02",
      status: "success",
      message: "Data retrieved successfully",
      data: result,
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

router.post("/reply", requireAdminLogin, async (req, res) => {
  const connection = await poolPromise().getConnection();

  try {
    const { msg_id, message } = req.body;
    const userMobile = req.admin.mobile;

    // Fetch data from work_report table based on msg_id
    const [originalMessage] = await connection.query(
      "SELECT send_from, subject FROM work_report WHERE msg_id = ? ",
      [msg_id]
    );

    if (originalMessage.length === 0) {
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message: "Original message not found",
      });
    }

    // Insert data for the reply into work_report table
    await connection.beginTransaction();

    await connection.query(
      "INSERT INTO work_report (send_from, send_to, messa_type, msg_id, subject, message, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        userMobile,
        originalMessage[originalMessage.length - 1].send_from,
        "reply",
        msg_id,
        originalMessage[0].subject,
        message,
        "New",
      ]
    );

    await connection.commit();

    return res.status(200).json({
      status_code: "02",
      status: "success",
      message: "Reply sent successfully",
      msg_id,
    });
  } catch (error) {
    console.error(error);
    await connection.rollback();
    return res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Internal Server Error",
    });
  } finally {
    await connection.release();
  }
});

router.post("/work-report", requireAdminLogin, async (req, res) => {
  const connection = await poolPromise().getConnection();

  try {
    const { msg_id, mobile } = req.body; // give either msg_id or mobile
    const userMobile = req.admin.mobile;
    let query;
    let queryParams;

    if (msg_id) {
      // If msg_id is provided, fetch data based on msg_id
      query =
        "SELECT * FROM work_report WHERE msg_id = ? ORDER BY created_at ASC";
      queryParams = [msg_id];
    } else if (mobile) {
      // If mobile is provided, fetch data based on mobile
      query =
        "SELECT * FROM work_report WHERE (send_from = ? OR send_to = ?) ORDER BY created_at ASC";
      queryParams = [mobile, mobile];
    } else {
      // If neither msg_id nor mobile is provided, return an error
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message: "Either msg_id or mobile must be provided",
      });
    }

    // Fetch data from work_report table
    const [workReportData] = await connection.query(query, queryParams);

    return res.status(200).json({
      status_code: "02",
      status: "success",
      message: "Work report data retrieved successfully",
      data: workReportData,
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

router.post("/close-message", requireAdminLogin, async (req, res) => {
  const connection = await poolPromise().getConnection();

  try {
    const { msg_id, status } = req.body;

    // Check if the provided status is valid
    if (status !== "Deleted" && status !== "Closed") {
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message: 'Invalid status. Only "Deleted" or "Closed" are allowed.',
      });
    }

    // Fetch message data for the specified msg_id
    const [messageData] = await connection.query(
      "SELECT * FROM work_report WHERE msg_id = ?",
      [msg_id]
    );

    if (messageData.length === 0) {
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message: "No message data available for the specified msg_id",
      });
    }

    // Update status for the message data
    await connection.beginTransaction();

    await connection.query(
      "UPDATE work_report SET status = ? WHERE msg_id = ?",
      [status, msg_id]
    );

    // Commit the transaction
    await connection.commit();

    return res.status(200).json({
      status_code: "02",
      status: "success",
      message: "Message status updated successfully",
    });
  } catch (error) {
    console.error(error);
    await connection.rollback();
    return res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Internal Server Error",
    });
  } finally {
    await connection.release();
  }
});
router.get('/active_connections', async (req, res) => {
  try {
      const connection = await poolPromise().getConnection();
      const [statusResults, processListResults] = await Promise.all([
          connection.query('SHOW STATUS WHERE variable_name IN ("Threads_connected", "Threads_created", "Max_used_connections")'),
          connection.query('SELECT * FROM INFORMATION_SCHEMA.PROCESSLIST')
      ]);
      connection.release();
      
      const activeConnections = statusResults[0].find(row => row.Variable_name === 'Threads_connected').Value;
      const totalConnections = statusResults[0].find(row => row.Variable_name === 'Max_used_connections').Value;
      const maxUsedConnections = statusResults[0].find(row => row.Variable_name === 'Threads_created').Value; // Assuming this reflects total connections
      const availableConnections = totalConnections - activeConnections;
      const connectedConnections = processListResults;

      res.status(200).json({
          activeConnections,
          totalConnections,
          availableConnections,
          maxUsedConnections,
          connectedConnections
      });
  } catch (err) {
      console.error('Error:', err);
      res.status(500).json({
          status: 'Failed',
          error: 'Failed to fetch active connections'
      });
  }
});
router.get('/active_connections_', async (req, res) => {
  async function getActiveConnections() {
      const connection = await poolPromise().getConnection();

      try {
          const rows = await connection.query('SHOW PROCESSLIST');
          const activeConnections = rows.filter(row => row.Command !== 'Sleep').length;
          return activeConnections;
      } finally {
          connection.release();
      }
  }

  try {
      const activeConnections = await getActiveConnections();
      console.log('Number of active connections:', activeConnections);
      res.status(200).json({ activeConnections });
  } catch (err) {
      console.error('Error:', err);
      res.status(500).json({ error: 'Failed to fetch active connections' });
  }
});


//ticket end

module.exports = router;
