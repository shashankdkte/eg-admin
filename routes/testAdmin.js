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
          designation 
        ];

        const sql_insert =
          "INSERT INTO `staff_data` (`application_id`,`unique_id`, `department_id`, `designation_id`, `emp_id`, `name`, `mobile`, `email`, `mapping`,`designation`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,?)";

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

router.post("/appoint", requireAdminLogin, async (req, res) => {
  try {
    // Use promise-based connection
    const connection = await poolPromise().getConnection();
    const approve_by = req.admin.accountid;
    try {
      console.log('cming in appoint')
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
            const [district] = await connection.query(
                `SELECT * FROM district WHERE district_name = ? AND state_name = ?`,
                [district_name, state_name]
            );
            if (district.length === 0) {
                res.status(404).json({
                    status_code: "2",
                    status: "failed",
                    message: "Invalid district name",
                });
            }

            console.log('district state',district_name, state_name)
            //terrotory district and state name add hoga 
            // conditoin ki pehele se add he to  user type dekhna agr usertype asm he to if asm is adding then this is already added
            // ek sales manager ko ek ek hi area allot hoga 

            // 

            const [territory] = await connection.query(
              `SELECT * FROM territory WHERE district = ? AND state = ?`,
              [district_name,state_name]
            );

            console.log('terrotory',territory)
            //user_type have designation_id
            if(territory && territory[0] && territory[0].user_type === '001' || territory && territory[0] && territory[0].user_type === '002'){
              return res.status(404).json({
                status_code: "2",
                status: "failed",
                message: `this user_type Business Development already exist in territory table with same district and state`,
              });
            }

            console.log('territory is here',territory)

            if (district.length === 0) {
             return res.status(404).json({
                status_code: "2",
                status: "failed",
                message: " Invalid district name",
              });
            }


            await connection.query(
              `
              INSERT INTO territory (user_type, unique_id, pincode, district, state, status)
              VALUES (?, ?, ?, ?, ?, 'Enable')
            `,
              [
                staff_data[0].designation_id,
                staff_data[0].unique_id,
                " ",
                district_name,
                district[0].state_name,
              ]
            );


            //updating staff if business developemtn is not already present
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