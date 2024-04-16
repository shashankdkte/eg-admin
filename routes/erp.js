const express = require("express");
const router = express.Router();
const uuid = require("uuid");
const axios = require("axios");
const poolPromise = require("../util/connnectionPromise.js");
const poolPromise2 = require("../util/connnectionPromise2.js");
const moment = require("moment-timezone");
const smsapi = require("../globalfunction/sms");
moment().tz("Asia/Calcutta").format();
process.env.TZ = "Asia/Calcutta";
const requireLogin = require("../middleware/requireLogin.js");
const requireFseLogin = require("../middleware/requireFseLogin.js");
const requireStaffLogin = require("../middleware/requireEmpLogin.js");
const md5 = require("md5");
const SALT = process.env.SALT.toString();
const { savevirtualaccount } = require("../globalfunction/savevirtualaccount");
const path = require("path");
const multer = require("multer");
const { uniqueId } = require("lodash");
const { hashOtp, VerifyOtp, getAdhaarConsent, getAdhaarOTP, getAdhaarFile } = require("../middleware/hashOtp");
const { getSecretKeyAndTimeStamp , checkDetails} = require("../globalfunction/getSecretKey.js");

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
// Configure multer storage for file uploads
const storages2 = multer.diskStorage({
  destination: "./assets/image/userkycdocs",
  filename: (req, file, cb) => {
      return cb(
          null,
          `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`
      );
  },
});

const upload2 = multer({
  storage: storages2,
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

router.get("/web-navigation", requireLogin, async (req, res) => {
  try {
    // Use promise-based connection
    const connection = await poolPromise().getConnection();

    try {
      const sql =
        "SELECT * FROM web_navigation WHERE parent = ? AND user_type = ?";
      const value = [0, "Distributor"];

      const [parent_menu] = await connection.query(sql, value);

      const menu = [];
      for (let i = 0; i < parent_menu.length; i++) {
        const parent_id = parent_menu[i].id;
        const sql1 =
          "SELECT * FROM web_navigation WHERE parent = ? AND user_type = ?";
        const value1 = [parent_id, "Distributor"];

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
        .json({ status_code: "2", status: "fail", error: err.message });
    } finally {
      // Release the connection
      if (connection) {
        await connection.release();
      }
    }
  } catch (err) {
    return res
      .status(422)
      .json({ status_code: "2", status: "fail", error: err.message });
  }
});

//New API Distributor Pin start

router.get("/pin-status", requireLogin, async (req, res) => {

  const { user_type, unique_id } = req.login;

  // Validate user_type
  if (user_type !== 'Distributor') {
    return res.status(400).json({
      status_code: "2",
      status: "fail",
      message: "Invalid user type. User type must be 'Distributor' ."
    });
  }

  // Use promise-based connection
  const connection = await poolPromise().getConnection();
  try {
    // Fetch pin from the login table
    const sql = "SELECT pin FROM login WHERE user_type = ? AND unique_id = ? AND (status = '1' OR status = '2')";
    const [results] = await connection.query(sql, [user_type, unique_id]);

    let message = "";
    if (results.length > 0 && results[0].pin) {
      message = "Pin available.";
    } else {
      message = "Pin not available.";
    }

    return res.status(200).json({
      status_code: "1",
      status: "success",
      message: message
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status_code: "2",
      status: "fail",
      message: "Internal Server Error"
    });
  } finally {
    if (connection) {
      await connection.release();
    }
  }
});

router.get("/set-pin/:pin", requireLogin, async (req, res) => {

  const { pin } = req.params;
  const { user_type, unique_id } = req.login;

  // Validate user_type
  if (user_type !== 'Distributor') {
    return res.status(400).json({
      status_code: "2",
      status: "fail",
      message: "Invalid user type. User type must be 'Distributor'."
    });
  }

  // Use promise-based connection
  const connection = await poolPromise().getConnection();
  try {
    // Check if pin is null
    const [existingPin] = await connection.query(
      "SELECT pin FROM login WHERE user_type = ? AND unique_id = ? AND (status = '1' OR status = '2') ",
      [user_type, unique_id]);

    if (existingPin.length > 0 && existingPin[0].pin !== null) {
      return res.status(200).json({
        status_code: "2",
        status: "success",
        message: "Pin already available."
      });
    }

    // Update pin
    await connection.query(
      "UPDATE login SET pin = ? WHERE unique_id = ?",
      [pin, unique_id]);

    return res.status(200).json({
      status_code: "1",
      status: "success",
      message: "Pin set successfully."
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status_code: "2",
      status: "fail",
      message: "Internal Server Error"
    });
  } finally {
    if (connection) {
      await connection.release();
    }
  }
});

router.post("/change-pin", requireLogin, async (req, res) => {
  const { oldPin, newPin } = req.body;
  const { unique_id } = req.login;

  // Use promise-based connection
  const connection = await poolPromise().getConnection();
  try {
    // Check if the old pin matches
    const [existingPin] = await connection.query(
      "SELECT pin FROM login WHERE unique_id = ? AND (status = '1' OR status = '2') ",
      [unique_id]
    );

    if (!existingPin.length || existingPin[0].pin !== oldPin) {
      return res.status(200).json({
        status_code: "2",
        status: "success",
        message: "Old pin verification failed."
      });
    }

    // Update the pin
    await connection.query(
      "UPDATE login SET pin = ? WHERE unique_id = ?",
      [newPin, unique_id]
    );

    return res.status(200).json({
      status_code: "1",
      status: "success",
      message: "Pin changed successfully."
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status_code: "2",
      status: "fail",
      message: "Internal Server Error"
    });
  } finally {
    if (connection) {
      await connection.release();
    }
  }
});

//New API Distributor Pin end

router.get("/fetch-territory", requireLogin, async (req, res) => {

  const connection = await poolPromise().getConnection();

  try {
    // Extract user_id from the request
    const { unique_id } = req.login;

    // Fetch territory data for the given user_id
    const [territoryResults] = await connection.query(
      "SELECT * FROM territory WHERE unique_id = ?",
      [unique_id]
    );

    return res.status(200).json({
      status: "success",
      data: territoryResults,
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  } finally {
    if (connection) {
      await connection.release();
    }
  }
});

router.post("/stock-transfer", requireLogin, async (req, res) => {
  const connection = await poolPromise().getConnection();
  const connection2 = await poolPromise2().getConnection();
  const { products } = req.body;
  const { unique_id: distributorId, customer_id, created_by } = req.login;
 
try {
  

// Check for mapping between distributor and customer
const [results] = await connection.query("SELECT COUNT(*) AS count FROM login WHERE customer_id = ?", [customer_id]);

  if (results[0].count < 1)
{
  return res.status(500).json({
        status_code: "2",
        status: "failed",
        message: "Distributor not available",
      });
  }
  const [results_value] = await connection.query("SELECT unique_id  FROM login WHERE customer_id = ?", [customer_id]);
  
  const unique_id_value = results_value[0].unique_id
 
 
const getProductValue = async (productId) => {
const query = 'SELECT mrp FROM products WHERE product_id = ?';
const [results] = await connection.query(query, [productId]);
return results[0].mrp;
};

const getProductStock = async (productId) => {
const query = 'SELECT quantity FROM stock WHERE purchase_id = ?';
const [results] = await connection.query(query, [productId]);
return results[0].quantity;
};
const updateStockAndStockData = async (product) => {
const productValue = await getProductValue(product.product_id);
const stockValue = product.quantity * productValue;
 

  
  const order_id =
    Math.floor(1000 + Math.random() * 9000).toString() + Date.now();
  const created_on = moment().format("YYYY-MM-DD HH:mm:ss");
  const opening_stock = await getProductStock(product.product_id)
  const closing_stock = opening_stock - +product.quantity
  try
  {
  

    await connection.query(
      "INSERT INTO stock_summary ( order_id, unique_id, transaction_type, transaction_at, product_id, opening_stock, quantity, closing_stock, description) VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        order_id,
        unique_id_value,
        "Debit",
        created_on,
        product.product_id,
        opening_stock,
        product.quantity,
        closing_stock,
        `${product.quantity} stock Debit Successfully`,
      ]
    );
  }
  catch (err)
  {
    return res.status(500).json({
        status_code: "2",
        status: "failed",
        message: "Unable to insert data into stock_summary",

      });
  }

   // Decrease stock_value in stock table
const decreaseQuery = 'UPDATE stock SET quantity = quantity - ? WHERE purchase_id = ?'; 
await connection.query(decreaseQuery, [product.quantity,product.product_id]);


  // Update entry to stock_data table
  const addEntryQuery = 'UPDATE stock_data SET product_value = product_value + ?  WHERE unique_id = ?';

  await connection.query(addEntryQuery, [stockValue, unique_id_value]);
};


// Check if products exist with stock
  const checkProductAvailability = async (product) => {
const query = 'SELECT COUNT(*) AS count FROM stock WHERE purchase_id = ? AND quantity >= ?';
    const [results] = await connection.query(query, [product.product_id, +product.quantity]);
return results[0].count > 0;
};

const product_availability = await Promise.all(products.map(checkProductAvailability));
 for (let i = 0; i < products.length; i++) {
   const product = products[i];
    const isAvailable = product_availability[i];
    if (isAvailable) {
     console.log(`Product ${product.product_id} with quantity ${product.quantity} is available`);
     await updateStockAndStockData(product);
    } else
    {
      return res.status(201).json({
        status_code: "2",
        status: "failed",
        message: `Product ${product.product_id} with quantity ${product.quantity}  is not available`,
      });
   
    }
  }

return res.status(201).json({
        status_code: "1",
        status: "success",
        message: "Stock Transfered ",
      });
  } catch (error) {
  return res.status(500).json({
        status_code: "2",
        status: "failed",
    message: "Internal ServerError",

      });
}
finally {
  await connection.release();
}
})


// router.post("/stock-transfer", requireLogin, async (req, res) => {
//     const connection = await poolPromise().getConnection();
//     const connection2 = await poolPromise2().getConnection();
//     const { products } = req.body;
//   const { unique_id: distributorId, customer_id, created_by } = req.login;
//   try {
    
  
//   // Check for mapping between distributor and customer
//   const [results] = await connection.query("SELECT COUNT(*) AS count FROM fse WHERE distributor_id = ?", [customer_id]);
//   if (results[0].count < 1)
//   {
//     return res.status(500).json({
//           status_code: "2",
//           status: "failed",
//           message: "Distributor not available",
//         });
//     }
//      const [results_value] = await connection.query("SELECT unique_id  FROM fse WHERE distributor_id = ?", [customer_id]);
//     const unique_id_value = results_value[0].unique_id
  

//   const getProductValue = async (productId) => {
//   const query = 'SELECT mrp FROM products WHERE product_id = ?';
//   const [results] = await connection.query(query, [productId]);
//   return results[0].mrp;
//   };
  
//  const getProductStock = async (productId) => {
//   const query = 'SELECT quantity FROM stock WHERE purchase_id = ?';
//   const [results] = await connection.query(query, [productId]);
//   return results[0].quantity;
//   };
//   const updateStockAndStockData = async (product) => {
//   const productValue = await getProductValue(product.product_id);
//   const stockValue = product.quantity * productValue;
   
 
    
//     const order_id =
//       Math.floor(1000 + Math.random() * 9000).toString() + Date.now();
//     const created_on = moment().format("YYYY-MM-DD HH:mm:ss");
//     const opening_stock = await getProductStock(product.product_id)
//     const closing_stock = opening_stock - +product.quantity
//     try
//     {
    
  
//       await connection.query(
//         "INSERT INTO stock_summary ( order_id, unique_id, transaction_type, transaction_at, product_id, opening_stock, quantity, closing_stock, description) VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?)",
//         [
//           order_id,
//           unique_id_value,
//           "Debit",
//           created_on,
//           product.product_id,
//           opening_stock,
//           product.quantity,
//           closing_stock,
//           `${product.quantity} stock Debit Successfully`,
//         ]
//       );
//     }
//     catch (err)
//     {
//       return res.status(500).json({
//           status_code: "2",
//           status: "failed",
//           message: "Unable to insert data into stock_summary",

//         });
//     }

//      // Decrease stock_value in stock table
//   const decreaseQuery = 'UPDATE stock SET quantity = quantity - ? WHERE purchase_id = ?'; 
//   await connection.query(decreaseQuery, [product.quantity,product.product_id]);
 
  
//     // Update entry to stock_data table
//     const addEntryQuery = 'UPDATE stock_data SET product_value = product_value + ?  WHERE unique_id = ?';

//     await connection.query(addEntryQuery, [stockValue, unique_id_value]);
// };


//   // Check if products exist with stock
//     const checkProductAvailability = async (product) => {
//   const query = 'SELECT COUNT(*) AS count FROM stock WHERE purchase_id = ? AND quantity >= ?';
//       const [results] = await connection.query(query, [product.product_id, +product.quantity]);
//   return results[0].count > 0;
// };
  
//   const product_availability = await Promise.all(products.map(checkProductAvailability));
//    for (let i = 0; i < products.length; i++) {
//      const product = products[i];
//       const isAvailable = product_availability[i];
//       if (isAvailable) {
//        console.log(`Product ${product.product_id} with quantity ${product.quantity} is available`);
//        await updateStockAndStockData(product);
//       } else
//       {
//         return res.status(201).json({
//           status_code: "2",
//           status: "failed",
//           message: `Product ${product.product_id} with quantity ${product.quantity}  is not available`,
//         });
     
//       }
//     }

//   return res.status(201).json({
//           status_code: "1",
//           status: "success",
//           message: "Stock Transfered ",
//         });
//     } catch (error) {
//     return res.status(500).json({
//           status_code: "2",
//           status: "failed",
//       message: "Internal ServerError",

//         });
//   }
//   finally {
//     await connection.release();
//   }
// })
// pending
router.post("/add-fse", requireLogin, async (req, res) => {
  const connection = await poolPromise().getConnection();
  const connection2 = await poolPromise2().getConnection();

  try {
    const { name, mobile_number, email, address, territory } = req.body;
    const { unique_id: distributorId, customer_id, created_by } = req.login;
    // Extract user_id from the request
    // check if mobile_number already exist
    const [results] = await connection.query('SELECT COUNT(*) AS count FROM fse WHERE mobile_number = ?', [mobile_number]) 
    if (results[0].count > 0)
    {
       return res.status(500).json({
          status_code: "2",
          status: "failed",
          message: "Duplicate Mobile number",
        });
    }
 

    // Function to generate a random 9-digit agent ID
    const generateAgentId = Math.floor(100000000 + Math.random() * 900000000);

    // Function to generate a unique ID using uuid
    const generateUniqueId = uuid.v4();
    var successPins = [];
      // Check if the PIN code is available for distributor 
      const [existingPin] = await connection.query(
        "SELECT * FROM territory WHERE unique_id = ? AND pincode = ? AND status = 'Enable' ",
        [distributorId, territory]
      );
    
      const fse_tdata = existingPin.map(({  area, pincode, district, state }) => [
        "F.S.E",
        area,
        generateUniqueId,
        pincode,
        "Enable",
        district,
        state
      ])
    
    
      if (existingPin.length === 0) {
        // PIN is not available, push the PIN to the errorPins array
        return res.status(500).json({
          status_code: "2",
          status: "failed",
          message: "Invalid Distributor Territory PIN Code",
        });

      } else {
        // PIN is available, proceed with the necessary actions
        // Check if an FSE is already assigned for this PIN
        const [FseTerritories] = await connection.query(
          "SELECT unique_id FROM territory WHERE unique_id != ? AND pincode = ? AND status = 'Enable' ",
          [distributorId, territory]
        );
        console.log(FseTerritories);
        if (FseTerritories.length === 0) {
          // No FSE assigned, push the PIN to the successPins array
          // Insert data into the territory table

          await connection.query(
            "INSERT INTO territory (user_type, area, unique_id, pincode, status, district, state) VALUES ?",
            [fse_tdata]
          );
          successPins.push(territory);

        } else {
          // FSE already assigned for this PIN, check FSE status
          // Check if an FSE is already assigned for this PIN
          for (const { unique_id } of FseTerritories) {
            const [existingFSEs] = await connection.query(
              "SELECT status FROM fse WHERE unique_id = ?",
              [unique_id]
            );
            if (existingFSEs.length === 0) {
              return res.status(500).json({
                status_code: "2",
                status: "failed",
                message: "Internal Server Error",
              });
              
            } else if (existingFSEs[0].status === "0") {
              // FSE is suspended, push the PIN to the successPins array
              // Insert data into the territory table
             
              await connection.query(
                "INSERT INTO territory (user_type, area, unique_id, pincode, status, district, state) VALUES ?",
                [fse_tdata]
              );
              successPins.push(territory);
             
            } else {
              // FSE is active, push the PIN to the errorPins array
              return res.status(500).json({
                status_code: "2",
                status: "failed",
                message: "FSE is already active in this territory. ",
              });
            }
          }
        }
      }
    
    

    if (successPins.length > 0) {
      // At least one successful PIN, insert data into the fse table

      // Insert data into the fse table
      await connection.query(
        "INSERT INTO fse (distributor_id , asm_id, unique_id, agent_id, name, mobile_number, email, address, status, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '1', ?)",
        [
          customer_id,
          created_by,
          generateUniqueId,
          generateAgentId,
          name,
          mobile_number,
          email,
          JSON.stringify(address),
          new Date(),
        ]
      );
      await connection2.query(
        "INSERT INTO wallets (user_type, unique_id, wallet, hold, unsettle, createdAt, status) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP(), ?)",
        ["F.S.E", generateUniqueId, 0, 0, 0, "Enable"]
      );

      await connection.query("INSERT INTO stock_data(unique_id,product_value,state) VALUES(?,?,?)",[generateUniqueId,0,'Enable'])
    }
    successPins.length > 0 ? smsapi("admin", "fsc_registration",mobile_number, generateAgentId): "";
    // Send response with success and error PIN details
    return res.status(200).json({
      status_code: successPins.length > 0 ? "1" : "2",
      status: successPins.length > 0 ? "success" : "failed",
      agent_id: successPins.length > 0 ? generateAgentId : undefined,
      message:
        successPins.length > 0
          ? "Field Sales Executive Successfully Created"
          : "No PINs available or FSE already assigned for all PINs"
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

//pending test
router.put("/modify-fse", requireLogin, async (req, res) => {
  const connection = await poolPromise().getConnection();

  try {
    const { agent_id, name, mobile_number, email, address, status } = req.body;

    // Update FSE data based on the agent_id
    const [updateResult] = await connection.query(
      "UPDATE fse SET name = ?, mobile_number = ?, email = ?, address = ?, status = ? WHERE agent_id = ?",
      [name, mobile_number, email, JSON.stringify(address), status, agent_id]
    );

    if (updateResult.affectedRows === 0) {
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message: "FSE not found or not modified",
      });
    }

    // Send success response
    return res.status(200).json({
      status_code: "1",
      status: "success",
      message: "FSE modified successfully",
      data: {
        fse_id: updateResult.insertId,
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

router.get("/get-fse", requireLogin, async (req, res) => {
  const connection = await poolPromise().getConnection();
  const customer_id = req.login.customer_id;
  try {
    const { agent_id } = req.query;
    const data = [];

    if (agent_id) {
      // Fetch FSE data based on the agent_id
      var [fseResults] = await connection.query(
        "SELECT id AS Fse_id, unique_id, agent_id, name, mobile_number FROM fse WHERE agent_id = ?",
        [agent_id]
      );
      if (fseResults.length > 0) {
        var [fseTerritoryResults] = await connection.query(
          "SELECT * FROM territory WHERE unique_id = ?",
          [fseResults[0].unique_id]
        );
        data.push({ fseResults, territory: fseTerritoryResults });
      }
    } else {
      // Fetch FSE data based on the agent_id
      var [fseResults] = await connection.query(
        "SELECT id AS Fse_id, unique_id, agent_id, name, mobile_number FROM fse WHERE distributor_id = ?",
        [customer_id]
      );
      if (fseResults.length > 0) {
        for (let i = 0; i < fseResults.length; i++) {
          var [fseTerritoryResults] = await connection.query(
            "SELECT * FROM territory WHERE unique_id = ?",
            [fseResults[i].unique_id]
          );
          data.push({
            fseResults: fseResults[i],
            territory: fseTerritoryResults,
          });
        }
      }
    }

    if (fseResults.length === 0) {
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message: "FSE not found",
      });
    }

    // Send response with FSE details
    return res.status(200).json({
      status_code: "1",
      status: "success",
      message: "FSE details retrieved successfully",
      data: data,
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

//pending test
router.put("/remove-territory", requireLogin, async (req, res) => {
  const connection = await poolPromise().getConnection();

  try {
    const { agent_id, pin_codes } = req.body;

    // Fetch unique_id from fse table based on agent_id
    const [fseResult] = await connection.query(
      "SELECT unique_id FROM fse WHERE agent_id = ?",
      [agent_id]
    );

    if (fseResult.length === 0) {
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message: "FSE not found",
      });
    }

    const unique_id = fseResult[0].unique_id;

    // Update territory status to 'Disable' for the specified pin codes
    const updateResults = await Promise.all(
      pin_codes.map(async (pin) => {
        const [updateResult] = await connection.query(
          "UPDATE territory SET status = 'Disable' WHERE unique_id = ? AND pincode = ?",
          [unique_id, pin]
        );
        return updateResult;
      })
    );

    // Check if any update was successful
    const anySuccess = updateResults.some((result) => result.affectedRows > 0);

    if (anySuccess) {
      return res.status(200).json({
        status_code: "1",
        status: "success",
        message: "Territories removed successfully",
        data: {
          fse_id: fseResult[0].id,
        },
      });
    } else {
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message: "No territories removed or invalid pin codes",
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

//pending test
router.post("/add-territory", requireLogin, async (req, res) => {
  const connection = await poolPromise().getConnection();

  try {
    const { agent_id, territory } = req.body;
    const { unique_id: distributorId } = req.login;
    // Extract user_id from the request

    const territories = territory; // Array of PIN codes [pin ,pin ,pin]

    const [existingFSE] = await connection.query(
      "SELECT * FROM fse WHERE agent_id = ?  ",
      [agent_id]
    );

    const fseUniqueId = existingFSE[0].unique_id;
    const successPins = [];
    const errorPins = [];
    for (const pin of territories) {
      // Check if the PIN code is available
      const [existingPin] = await connection.query(
        "SELECT * FROM territory WHERE unique_id = ? AND pincode = ? AND status = 'Enable' ",
        [distributorId, pin]
      );

      if (existingPin.length === 0) {
        // PIN is not available, push the PIN to the errorPins array
        errorPins.push(pin);
      } else {
        // PIN is available, proceed with the necessary actions
        // Check if an FSE is already assigned for this PIN
        const [FseTerritories] = await connection.query(
          "SELECT unique_id FROM territory WHERE unique_id != ? AND pincode = ? AND status = 'Enable' ",
          [distributorId, pin]
        );

        if (FseTerritories.length === 0) {
          // No FSE assigned, push the PIN to the successPins array
          successPins.push(pin);

          // Insert data into the territory table
          await connection.query(
            "INSERT INTO territory (unique_id, pincode, status, district, state) VALUES (?, ?, 'Enable', ?, ?)",
            [generateUniqueId, pin, " ", " "]
          );
        } else {
          // FSE already assigned for this PIN, check FSE status
          // Check if an FSE is already assigned for this PIN
          for (const { unique_id } of FseTerritories) {
            const [existingFSEs] = await connection.query(
              "SELECT status FROM fse WHERE unique_id = ?",
              [unique_id]
            );
            if (existingFSEs.length === 0) {
              errorPins.push(pin);
              continue;
            } else if (existingFSEs[0].status === "0") {
              // FSE is suspended, push the PIN to the successPins array
              // Insert data into the territory table
              await connection.query(
                "INSERT INTO territory (unique_id, pincode, status, district,state) VALUES (?, ?, 'Enable', ?, ?)",
                [fseUniqueId, pin, " ", " "]
              );
              successPins.push(pin);
            } else {
              // FSE is active, push the PIN to the errorPins array
              while (successPins.includes(pin)) {
                successPins.splice(successPins.lastIndexOf(pin), 1); // Remove from the end for efficiency
              }
              // console.log(successPins);
              errorPins.push(pin);
              break;
            }
          }
        }
      }
    }

    // Send response with success and error PIN details
    return res.status(200).json({
      status_code: successPins.length > 0 ? "1" : "2",
      status: successPins.length > 0 ? "success" : "failed",
      message:
        successPins.length > 0
          ? "Field Sales Executive territory Successfully Added"
          : "No PINs available or FSE already assigned for all PINs",
      success_pins: successPins,
      error_pins: errorPins,
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

router.post("/request-evalue", requireLogin, upload3.fields([
  { name: "uploadReceipt", maxCount: 1 }
]), async (req, res) => {
  const connection = await poolPromise2().getConnection();

  try {
    const {
      depositBankName,
      depositDate,
      modeOfPayment,
      amount,
      transactionReferenceNumber
    } = req.body;

    // Example: Get user's information from the login_data table
    const { unique_id, customer_id } = req.login;
    const order_id = Date.now();

    const [existingEvalue] = await connection.query(
      "SELECT * FROM evalues WHERE unique_id = ? AND bank_ref_num = ? ",
      [unique_id, transactionReferenceNumber]
    );

    if (existingEvalue.length > 0) {

      return res.status(400).json({
        status_code: "2",
        status: "Fail",
        message: "bank reference number is already availbale.",
      });
    }
    
      const uploadReceipt = req?.files["uploadReceipt"]
      ? req?.files["uploadReceipt"][0]?.filename
      : null;
    
    // Insert data into evalue table
    const [insertResult] = await connection.query(
      "INSERT INTO evalues (request_at, order_id, unique_id, deposited, date, amount, mode_of_payment, bank_ref_num, receipt, status,createdAt,updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,NOW(),NOW())",
      [
        new Date(),
        order_id,
        unique_id,
        depositBankName,
        depositDate,
        amount,
        modeOfPayment,
        transactionReferenceNumber,
        uploadReceipt,
        "Pending",
      ]
    );

    if (insertResult.affectedRows === 1) {
      return res.status(200).json({
        status_code: "1",
        status: "Success",
        message: "Request E-Value successful",
      });
    } else {
      return res.status(500).json({
        status_code: "2",
        status: "Fail",
        message: "Failed to insert into evalues table",
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status_code: "2",
      status: "Fail",
      message: "Internal Server Error",
    });
  } finally {
    connection.release();
  }
});

router.get("/e-value-history", async (req, res) => {
  try {
    const { token } = req.headers;
    const { date, page = 1, limit = 10 } = req.body;

    // TODO: Implement token verification using the provided token

    const connection = await poolPromise2().getConnection();

    let query =
      "SELECT request_at, order_id, mode_of_payment, bank_ref_num, amount, status, remark FROM evalues";
    const params = [];

    if (date) {
      query += " WHERE date = ?";
      params.push(date);
    }

    query += ` ORDER BY request_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, (page - 1) * limit);

    const [results] = await connection.query(query, params);
    connection.release();

    return res.status(200).json({
      status: "Success",
      data: results,
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({
      status: "Error",
      message: "Internal Server Error",
    });
  }
});

router.get("/search-product", requireLogin, async (req, res) => {
  try {
    //   const { token } = req.headers;
    //   const { product_id } = req.body;

    const connection = await poolPromise().getConnection();
    const [results] = await connection.query("SELECT * FROM products", []);
    connection.release();

    if (results.length === 0) {
      return res.status(404).json({
        status: "Fail",
        message: "Product not found",
      });
    }

    const productDetails = results.map((product) => ({
      product_id: product.product_id,
      product_name: product.product_name,
      mrp: product.mrp,
      rate: product.rate,
      gst: product.gst,
      moq: product.moq,
    }));

    return res.status(200).json({
      status: "Success",
      data: productDetails,
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({
      status: "Error",
      message: "Internal Server Error",
    });
  }
});

router.post("/generated-order", requireLogin, async (req, res) => {
  try {
    const { products } = req.body;
    const { unique_id, customer_id, name } = req.login;
    const connection = await poolPromise().getConnection();

    let subTotal = 0;
    let cgst = 0;
    let sgst = 0;
    let roundOff = 0;
    let total = 0;
    var responsedata = [];
    const order_id =
      Math.floor(1000 + Math.random() * 9000).toString() + Date.now();
    const invoice_id =
      Math.floor(1000 + Math.random() * 9000).toString() + Date.now();
    const created_on = moment().format("YYYY-MM-DD HH:mm:ss");
    console.log(order_id, invoice_id, created_on);

    // Iterate through each product in the request
    for (const { product_id, moq } of products) {
      // Fetch product details from our_product table
      const [productResults] = await connection.query(
        "SELECT * FROM products WHERE product_id = ?",
        [product_id]
      );

      if (productResults.length === 0) {
        connection.release();
        return res.status(404).json({
          status: "Fail",
          message: "Product not found",
        });
      }

      var product = productResults[0];

      // Check if the requested MOQ is greater than our_product MOQ
      if (moq < product.moq) {
        connection.release();
        return res.status(200).json({
          status: "Fail",
          message: `Minimum Quantity of Order is ${product.moq}`,
        });
      }

      const rate = product.rate;
      const quantity = moq;
      const discount = 0; // Assuming no discount for now
      const gst = product.gst;
      const amount = rate * quantity;

      responsedata.push({
        product_id,
        product_name: product.product_name,
        hsncode: product.hsncode,
        rate: product.rate,
        quantity: moq,
        discount: 0,
        gst: product.gst,
        amount: product.rate * moq,
      });

      subTotal += amount;
      cgst += ((gst / 2) * amount) / 100;
      sgst += ((gst / 2) * amount) / 100;
    }

    total = subTotal + cgst + sgst;

    // Round off the total amount
    roundOff = total - Math.floor(total);

    function roundOffToOneOrZero(value) {
      return value >= 0.5 ? 1 : 0;
    }

    const decimalValue = roundOff;
    const roundedValue = roundOffToOneOrZero(decimalValue);
    total = Math.floor(total) + roundedValue;

    connection.release();

    return res.status(200).json({
      status: "Success",
      data: {
        products: responsedata,
        total: {
          "sub-Total": subTotal,
          Discount: 0,
          SGST: sgst,
          CGST: cgst,
          "Round Off": roundOff,
          Total: total,
        },
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: "Error",
      message: "Internal Server Error",
    });
  }
});

//doubt inv Unknown column 'created_on' in 'field list'



router.post("/conform-order", requireLogin, async (req, res) => {
  const { unique_id, customer_id, name } = req.login;
  var { products, pin } = req.body;
  console.log(unique_id);

  const connection = await poolPromise().getConnection();
  const connection2 = await poolPromise2().getConnection();
  try {
    await connection.beginTransaction();
    await connection2.beginTransaction();
    // Validate TPIN
    const [tpinResult] = await connection.query(
      "SELECT pin FROM login WHERE unique_id = ?",
      [unique_id]
    );

    if (tpinResult.length === 0 || tpinResult[0].pin !== String(pin)) {
      return res.status(400).json({ status: "fail", message: "Invalid PIN" });
    } else {
      // Validate product MOQ
      let subTotal = 0;
      let cgst = 0;
      let sgst = 0;
      let roundOff = 0;
      let total = 0;
      var responsedata = [];
      const order_id =
        Math.floor(1000 + Math.random() * 9000).toString() + Date.now();
      const invoice_id =
        Math.floor(1000 + Math.random() * 9000).toString() + Date.now();
      const created_on = moment().format("YYYY-MM-DD HH:mm:ss");
      console.log(order_id, invoice_id, created_on);
      var opening_stock = 0;
      // Iterate through each product in the request

      // for (const { product_id, moq } of products) {
      //   const [productResults] = await connection.query(
      //     "SELECT * FROM products WHERE product_id = ?",
      //     [product_id]
      //   );

      //   if (productResults.length === 0) {
      //     connection.release();
      //     return res.status(404).json({
      //       status: "Fail",
      //       message: "Product not found",
      //     });
      //   }
        
      //   var product = productResults[0];

      //   // Check if the requested MOQ is greater than our_product MOQ
      //   if (moq < product.moq) {
      //     // Rollback the transaction if an error occurs
      //     await connection.rollback();
      //     connection.release();
      //     return res.status(200).json({
      //       status: "Fail",
      //       product_id: product.product_id,
      //       product_mor: product.moq,
      //       you_moq: moq,
      //       message: `Minimum Quantity of Order is ${product.moq}`,
      //     });
      //   }

      //   const rate = product.rate;
      //   const quantity = moq;
      //   const discount = 0; // Assuming no discount for now
      //   const gst = product.gst;
      //   const amount = rate * quantity;

 
      //   // Insert data into inv_details table
      //   // const results = await connection.query(
      //   //   "INSERT INTO inv_details (id,unique_id, order_id, productid, productname, hsncode, rate, quantity, amount,  discount, total,free_qty) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      //   //   [
      //   //     1,
      //   //     unique_id,
      //   //     order_id,
      //   //     product.product_id,
      //   //     product.product_name,
      //   //     product.hsncode,
      //   //     rate,
      //   //     quantity,
      //   //     amount,
      //   //     "",
      //   //     discount,
      //   //     amount,
      //   //     0,
      //   //   ]
      //   // );


        
      //   const [stockResults] = await connection.query(
      //     "SELECT * FROM stock WHERE purchase_id = ? AND unique_id = ?",
      //     [product_id, unique_id]
      //   );

      //   if (stockResults.length === 0) {
      //     await connection.query(
      //       "INSERT INTO stock ( unique_id, customer_id, purchase_id, quantity) VALUES ( ?, ?, ?, ?)",
      //       [unique_id, customer_id, product_id, quantity]
      //     );
      //   } else {
      //     opening_stock = Number(stockResults[0].quantity);
      //     // Update stock
      //     await connection.query(
      //       "UPDATE stock SET quantity = quantity + ? WHERE purchase_id = ? AND unique_id = ? AND status = ?",
      //       [quantity, product_id, unique_id, "Enable"]
      //     );
      //   }
      //   const [stock_summaryResults] = await connection.query(
      //     "SELECT * FROM stock_summary WHERE product_id = ? AND unique_id = ? AND order_id = ?",
      //     [product_id, unique_id, order_id]
      //   );
      //   if (stock_summaryResults.length === 0) {
      //     await connection.query(
      //       "INSERT INTO stock_summary ( order_id, unique_id, transaction_type, transaction_at, product_id, opening_stock, quantity, closing_stock, description) VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      //       [
      //         order_id,
      //         unique_id,
      //         "Credit",
      //         created_on,
      //         product.product_id,
      //         opening_stock,
      //         product.moq,
      //         opening_stock + quantity,
      //         `${quantity} stock Credit Successfully`,
      //       ]
      //     );
      //   } else {
      //     // Update stock
      //     await connection.query(
      //       "UPDATE stock_summary  SET quantity = quantity + ?, closing_stock = ? WHERE product_id = ? AND unique_id = ? AND order_id = ?",
      //       [
      //         quantity,
      //         Number(stock_summaryResults[0].closing_stock) + Number(quantity),
      //         product_id,
      //         unique_id,
      //         order_id,
      //       ]
      //     );
      //   }

      //   responsedata.push({
      //     product_id,
      //     product_name: product.product_name,
      //     hsncode: product.hsncode,
      //     rate: product.rate,
      //     quantity: moq,
      //     discount: 0,
      //     gst: product.gst,
      //     amount: product.rate * moq,
      //   });
      //   opening_stock = 0;
      //   subTotal += amount;
      //   cgst += ((gst / 2) * amount) / 100;
      //   sgst += ((gst / 2) * amount) / 100;
      // }
async function getProductDetails(connection, product_id) {
  const [productResults] = await connection.query(
    "SELECT * FROM products WHERE product_id = ?",
    [product_id]
  );

  return productResults.length > 0 ? productResults[0] : null;
}

async function checkAndUpdateStock(connection, product_id, unique_id, quantity) {
  const [stockResults] = await connection.query(
    "SELECT * FROM stock WHERE purchase_id = ? AND unique_id = ?",
    [product_id, unique_id]
  );

  if (stockResults.length === 0) {
    await connection.query(
      "INSERT INTO stock ( unique_id, customer_id, purchase_id, quantity) VALUES ( ?, ?, ?, ?)",
      [unique_id, customer_id, product_id, quantity]
    );
  } else {
    await connection.query(
      "UPDATE stock SET quantity = quantity + ? WHERE purchase_id = ? AND unique_id = ? AND status = ?",
      [quantity, product_id, unique_id, "Enable"]
    );
  }
}

async function updateStockSummary(connection, product_id, unique_id, order_id, quantity, opening_stock) {
  const [stock_summaryResults] = await connection.query(
    "SELECT * FROM stock_summary WHERE product_id = ? AND unique_id = ? AND order_id = ?",
    [product_id, unique_id, order_id]
  );

  if (stock_summaryResults.length === 0) {
    await connection.query(
      "INSERT INTO stock_summary ( order_id, unique_id, transaction_type, transaction_at, product_id, opening_stock, quantity, closing_stock, description) VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        order_id,
        unique_id,
        "Credit",
        created_on,
        product_id,
        opening_stock,
        quantity,
        opening_stock + quantity,
        `${quantity} stock Credit Successfully`,
      ]
    );
  } else {
    await connection.query(
      "UPDATE stock_summary  SET quantity = quantity + ?, closing_stock = ? WHERE product_id = ? AND unique_id = ? AND order_id = ?",
      [
        quantity,
        Number(stock_summaryResults[0].closing_stock) + Number(quantity),
        product_id,
        unique_id,
        order_id,
      ]
    );
  }
}

for (const { product_id, moq } of products) {
  const product = await getProductDetails(connection, product_id);

  if (!product) {
    connection.release();
    return res.status(404).json({
      status: "Fail",
      message: "Product not found",
    });
  }

  if (moq < product.moq) {
    await connection.rollback();
    connection.release();
    return res.status(200).json({
      status: "Fail",
      product_id: product.product_id,
      product_mor: product.moq,
      you_moq: moq,
      message: `Minimum Quantity of Order is ${product.moq}`,
    });
  }

  const amount = product.rate * moq;

  await checkAndUpdateStock(connection, product_id, unique_id, moq);
  await updateStockSummary(connection, product_id, unique_id, order_id, moq, 0);

  await connection.query(
    "INSERT INTO inv_details (unique_id,order_id, productid, quantity, productname, hsncode, rate, amount, discount_type,discount,total) VALUES (?,?, ?, ?, ?, ?, ?, ?, ?,?,?)",
    [unique_id,order_id, product_id, moq, product.product_name, product.hsncode, product.rate, amount,null,0,amount]
  );

  responsedata.push({
    product_id,
    product_name: product.product_name,
    hsncode: product.hsncode,
    rate: product.rate,
    quantity: moq,
    discount: 0,
    gst: product.gst,
    amount: product.rate * moq,
  });
  responsedata.push({
    product_id,
    product_name: product.product_name,
    hsncode: product.hsncode,
    rate: product.rate,
    quantity: moq,
    discount: 0,
    gst: product.gst,
    amount,
  });

  subTotal += amount;
  cgst += ((product.gst / 2) * amount) / 100;
  sgst += ((product.gst / 2) * amount) / 100;
}

      total = subTotal + cgst + sgst;
      var gst = cgst + sgst;
      gst = Math.floor(gst);
      // Round off the total amount
      roundOff = total - Math.floor(total);

      function roundOffToOneOrZero(value) {
        return value >= 0.5 ? 1 : 0;
      }

      const decimalValue = roundOff;
      const roundedValue = roundOffToOneOrZero(decimalValue);

      const totalCost = Math.floor(total) + roundedValue; // total cost

      // Insert data into inv table
      await connection.query(
        "INSERT INTO inv (customer_id, order_id, invoice_id, unique_id, customer_type, subtotal, cgst, sgst, round_off, total, created_by, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          customer_id,
          order_id,
          invoice_id,
          unique_id,
          "Distributor",
          subTotal,
          cgst,
          sgst,
          roundOff,
          totalCost,
          customer_id,
          "Success",
        ]
      );

      // Debit from Wallet
      const [walletResult] = await connection2.query(
        "SELECT wallet FROM wallets WHERE unique_id = ?",
        [unique_id]
      );
     console.log(totalCost)
      const walletBalance = walletResult[0].wallet;
      if (walletBalance < totalCost) {
        // Rollback the transaction if an error occurs
        await connection.rollback();
        return res
          .status(400)
          .json({ status: "fail", message: "Insufficient Wallet Balance" });
      }

      // Debit from Wallet and update in Wallet Summary
      const update_amount = Number(walletBalance) - Number(totalCost);

      await connection2.query(
        "UPDATE wallets SET wallet = ? WHERE unique_id = ?",
        [update_amount, unique_id]
      );

      const [results] = await connection2.query(
        "SELECT MAX(`tran_id`) as max_tran_id FROM walletsummarys"
      );

      var tran_id_ = results[0].max_tran_id || 0;
      var tran_id_w_ = tran_id_ + 1;
      var description_ = `invoice_id ${invoice_id} and Order Cost Rs${totalCost}/- debited from your Wallet.`;

      const [update_wallet] = await connection2.query(
        "SELECT * FROM wallets WHERE unique_id = ?",
        [unique_id]
      );

      await connection2.query(
        "INSERT INTO walletsummarys (unique_id, tran_id, type, amount, status, description, closing_balance) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          unique_id,
          tran_id_w_,
          "DR",
          totalCost,
          "Success",
          description_,
          update_wallet[0].wallet,
        ]
      );

      // Credit to Admin Wallet
      const [admin_wallet] = await connection2.query(
        "SELECT * FROM admin_wallets WHERE status = ?",
        ["Enable"]
      );

      var bal_amount = Number(admin_wallet[0].wallet) + Number(totalCost) - Math.floor(gst);
      var admin_wbal = Number(totalCost) - Math.floor(gst);
      
      await connection2.query(
        "UPDATE admin_wallets SET wallet = ? ,gst = gst + ? WHERE id  = ?",
        [bal_amount, gst, admin_wallet[0].id]
      );

      const [result] = await connection2.query(
        "SELECT MAX(`tran_id`) as max_tran_id FROM admin_wallet_summarys"
      );

      var tran_id = result[0].max_tran_id || 0;
      var tran_id_w = tran_id + 1;
      var description = `invoice id ${invoice_id} Rs ${totalCost}/-  credited ${admin_wbal} to admin Wallet.`;

      const admin_summary = {
        tran_id: tran_id_w,
        unique_id: "bf508e4f-b685-11ec-9735-00163e0948d5",
        ac_type: "wallet",
        type: "CR",
        amount: admin_wbal,
        description: description,
        clo_bal: bal_amount,
        status: "Success",
      };

      await connection2.query("INSERT INTO admin_wallet_summarys SET ?", [
        admin_summary,
      ]);
      // gst data insert in admin_wallet_summary
      const admin_summary_gst = {
        tran_id: tran_id_w + 2,
        unique_id: "bf508e4f-b685-11ec-9735-00163e0948d5",
        ac_type: "gst",
        type: "CR",
        amount: gst,
        description: `invoice id ${invoice_id} Rs ${gst} Credit in GST Wallet.`,
        clo_bal: admin_wallet[0].gst + gst,
        status: "Success",
        transaction_at:new Date().toISOString().slice(0, 19).replace('T', ' ')
      };

      await connection2.query("INSERT INTO admin_wallet_summarys SET ?", [
        admin_summary_gst,
      ]);

      // Continue with the rest of your logic
      // Commit the transaction if everything is successful
      await connection.commit();
      await connection2.commit();
      return res.status(200).json({
        status_code: "1",
        status: "Success",
        data: {
          order: {
            order_id,
            invoice_id,
            customer_id: unique_id,
            customer_name: name,
          },
          products: responsedata,
          total: {
            "sub-Total": subTotal,
            Discount: 0,
            SGST: sgst,
            CGST: cgst,
            "Round Off": roundOff,
            Total: totalCost,
            Payment: totalCost,
            "Payment Mode": "wallet",
            Outstanding: 0,
          },
        },
      });
    }
  } catch (error) {
    console.error(error);
    // Rollback the transaction if an error occurs
    await connection.rollback();
    await connection2.rollback();
    return res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Failed to Conform Order",
    });
  } finally {
    connection.release();
    connection2.release();
  }
});

router.post("/get-invoice", requireLogin, async (req, res) => {
  const connection = await poolPromise().getConnection();

  try {
    const { date, page = 1, limit = 25 } = req.body;
    const { unique_id } = req.login;

    let query = `SELECT * FROM inv WHERE unique_id = ?`;
    const queryParams = [unique_id];

    if (date) {
      query += ` AND timestamp BETWEEN ? AND ? `;;
      queryParams.push(date + " 00:00:00", date + " 23:59:59",);
    }

    query += ` LIMIT ? OFFSET ?`;
    queryParams.push( limit, (page - 1) * limit);

    const [results] = await connection.query(query, queryParams);
    const extractedData = results.map(entry => ({
      timestamp: entry.timestamp,
      order_id: entry.order_id,
      invoice_id: entry.invoice_id,
      subtotal: entry.subtotal,
      discount: entry.discount,
      cgst: entry.cgst,
      sgst: entry.sgst,
      round_off: entry.round_off,
      total: entry.total
  }));
    return res.status(200).json({
      status: "success",
      data: extractedData,
    });
  } catch (error) {
    console.error(error.message);
    return res
      .status(500)
      .json({ status: "error", message: "Internal Server Error" });
  } finally {
    connection.release();
  }
});

router.get("/get-invoice-details/:orderId", requireLogin, async (req, res) => {
  const connection = await poolPromise().getConnection();

  try {
    const { orderId } = req.params;
    const { unique_id, customer_id, name } = req.login;
   

    // Fetching order details from the inv table
    const [orderResult] = await connection.query(
      "SELECT order_id, invoice_id, subtotal, cgst, sgst, round_off, total FROM inv WHERE order_id = ? AND unique_id = ?",
      [orderId, unique_id]
    );

    if (orderResult.length === 0) {
      return res
        .status(404)
        .json({ status: "fail", message: "Order not found" });
    }

    const orderDetails = {
      order_id: orderResult[0].order_id,
      invoice_id: orderResult[0].invoice_id,
      customer_id: customer_id,
      customer_name: name,
    };

    // Fetching product details from the inv_details table
    const [detailsResult] = await connection.query(
      "SELECT id AS inv_details_id, productid, productname, hsncode, rate, quantity, discount_type, discount, amount, total FROM inv_details WHERE order_id = ?",
      [orderId]
    );
   
    const productDetails = detailsResult.map((row) => ({
      product_id: row.productid,
      product_name: row.productname,
      hsncode: row.hsncode,
      rate: row.rate,
      quantity: row.quantity,
      discount: row.discount,
      amount: row.amount,
    }));

    const totalDetails = {
      subTotal: orderResult[0].subtotal,
      discount: 0,
      cgst: orderResult[0].cgst,
      sgst: orderResult[0].sgst,
      roundOff: orderResult[0].round_off,
      total: orderResult[0].total,
      Payment: orderResult[0].total,
      "Payment Mode": "Cass",
      Outstanding: 0,
    };

    return res.status(200).json({
      status: "success",
      data: {
        order: orderDetails,
        details: productDetails,
        total: totalDetails,
      },
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ status: "error", message: "Internal Server Error" });
  } finally {
    connection.release();
  }
});

//distributer onboarding CSP/REtailer start

router.get("/dst-search-stock", requireLogin, async (req, res) => {
  try {
    const { customer_id } = req.login;

    const connection = await poolPromise().getConnection();

    const [results] = await connection.query(
      "SELECT purchase_id AS Product_id, quantity FROM stock WHERE customer_id  = ?",
      [customer_id]
    );

    if (results.length === 0) {
      connection.release();
      return res.status(404).json({
        status: "Fail",
        message: "stock not found",
      });
    }

    connection.release();
    return res.status(200).json({
      status_code: "1",
      status: "Success",
      data: results,
    });
  } catch (error) {
    console.error(error.message);
    connection.release();
    return res.status(500).json({
      status: "Error",
      message: "Internal Server Error",
    });
  }
});

// router.post("/search-merchant", requireLogin, async (req, res) => {

//     const connection = await poolPromise2().getConnection();
//     try {
//         const {
//             agent_id,
//             mobile_number,
//             aadharNumber,
//             product_id
//         } = req.body;
      
//      let user_type = "csp"
     
//         // return res.send({status : 'failed', message:'env result ', data  :process.env.aadharVerificaton})
//        let  unique_id = req.id;
//         if (user_type === "csp" || user_type === "merchant")
//         {
//             const [userResult] = await connection.query(
//                 "SELECT * FROM auths WHERE user_type = ? AND mobile = ?",
//                 [user_type, mobile_number]
//             );
         
//             if (userResult.length > 0)
//             {
           
//                 const user = userResult[0];
//               console.log(user.id);
               
//                 switch (user.status)
//                 {
//                     case "6":

//                     //  return res.send({
//                     //      status: 'failed',
//                     //      message:'mobile already registered'
//                     //  })
//                         // Mobile number not verified, generate OTP
//                         const otp = Math.floor(100000 + Math.random() * 900000).toString();
//                         const saltedOTP = SALT.concat(otp);
//                         // const await = hashOtp
//                         const hashedOTP = await hashOtp(otp) ;
//                         // const hashedOTP = md5(saltedOTP);
//                         const auth_time = moment().format('YYYY-MM-DD HH:mm:ss')
//                         // Update OTP in the database
//                      const resultAuthData =   await connection.query(
//                             "UPDATE auths SET otp = ?, updatedAt = ? WHERE id = ?",
//                             [hashedOTP, auth_time, user.id]
//                         );

//                     //     console.log('updated',resultAuthData)

//                         // Send OTP to user mobile
//                         // console.log('otp',otp);
//                         //sms api error

//                         //global variable for confirmation from where this otp comes

//                         var otpMessage = ''
//                         var otpType = ''
//                         var access_key = ''

//                         // const getAddharConsentResult = await getAdhaarConsent(mobile_number)
//                         // console.log('getAddahrConsentResult', getAddharConsentResult)
//                         //  if(getAddharConsentResult.data.access_key){
//                         //     let accessKey = getAddharConsentResult.data.access_key
//                         // const getAddharOtpResult = await getAdhaarOTP(aadharNumber, accessKey, mobile_number)
//                         // console.log('getAddharOtpResult',getAddharOtpResult)
//                         //    //check otp send from aadhar or from user
//                         //    if(getAddharOtpResult.data.message){
//                         //     otpMessage = getAddharOtpResult.data.message
//                         //     otpType = 'Addhar',
//                         //     access_key = getAddharOtpResult.data.access_key

//                         //     return res.status(200).json({
//                         //         status_code: "20",
//                         //         status: "success",
//                         //         unique_id: user.unique_id,
//                         //         message: "OTP Successfully Send to CSP/Merchant Mobile Number.",
//                         //         otpType,
//                         //         otpMessage,
//                         //         access_key
//                         //         // 
//                         //         // getAddharOtpResult
//                         //     });
    
//                         //    }
//                         //  }



//                          if(!otpMessage && !otpType && !access_key){
//                           otpMessage = 'Otp send From OurSide'
//                           otpType = 'ourSide'  
//                        await smsapi("admin", "onboarding_code", mobile_number, otp, `3 min`);
//                    }
//                         // const response = await axios.get(
//                         //     `https://2factor.in/API/V1/1f985287-a3f0-11ee-8cbb-0200cd936042/SMS/+91${mobile_number}/${otp}/Onboarding+Confirmation`
//                         // );


//                         // connection.release();
                        
//                         return res.status(200).json({
//                             status_code: "20",
//                             status: "verify Mobile number",
//                             unique_id: user.unique_id,
//                             message: `Verification Code successfully send to user Type (${user.user_type}) Mobile Number.`,
//                             otpType,
//                             otpMessage,
//                             access_key
//                         });

//                     case "5":
//                         const [schemeResult] = await connection.query(
//                             "SELECT * FROM schemes WHERE usertype = ? AND status = ?",
//                             ["Merchant", "Enable"]
//                         );

//                         // const packageData = schemeResult.map((item) => {
//                         //     return {
//                         //         pack_name: item.packname,
//                         //         package_id: item.package_id,
//                         //         mrp: item.mrp,
//                         //         discount: item.discount,
//                         //         total: item.total,
//                         //     };
//                         // });

//                         connection.release();
//                         return res.status(200).json({
//                             status_code: "21",
//                             status: "pending",
//                             message: "Merchant onboard pending.",
//                             "data": {
//                                 "unique_id": user.unique_id,
//                                 "gender": "",
//                                 "dob": "",
//                                 "name": "",
//                                 "aadhar_number": aadharNumber,
//                                 "combinedAddress": ""
//                             }
//                             // data: packageData,
//                         });

//                     case "4":
//                         connection.release();
//                         return res.status(200).json({
//                             status_code: "22",
//                             status: "kyc pending",
//                             application_id: user.application_id,
//                             message: "Onboard Merchant KYC.",
//                             unique_id: user.unique_id,
//                         });

//                     case "3":
//                         connection.release();
//                         return res.status(200).json({
//                             status_code: "23",
//                             status: "Pending",
//                             application_id: user.application_id,
//                             message: "Service Activation is Pending",
//                             unique_id: user.unique_id,
//                         });

//                     case "2":
//                         connection.release();
//                         return res.status(200).json({
//                             status_code: "2",
//                             status: "Failed",
//                             message: `User Type ${user.user_type} is Already Registered`,
//                         });

//                     case "1":
//                         connection.release();
//                         return res.status(200).json({
//                             status_code: "2",
//                             status: "Failed",
//                             message: `User Type ${user.user_type} is Already Registered`,
//                         });

//                     case "0":
//                         connection.release();
//                         return res.status(200).json({
//                             status_code: "2",
//                             status: "Failed",
//                             message: `User Type ${user.user_type} is Suspended`,
//                         });
//                 }
//                 return res.status(200).json({ data: user });

            
//             }
//             else
//             {  
            
//                 console.log('coming in else part vikram',  process.env.aadharVerificaton);
//                 //if addhar verification true in env then call eko other wise not call eko
//                 if(process.env.aadharVerificaton === "true"){
//                   console.log('env addhar veification is true')
                 
//                         var otpMessage = ''
//                         var otpType = ''
//                         var access_key = ''
//                         console.log(process.env.aadharVerificaton);
//                         const getAddharConsentResult = await getAdhaarConsent(mobile_number)
//                         console.log('getAddahrConsentResult in else part', getAddharConsentResult)

//                          if(getAddharConsentResult.data.access_key){
//                             let accessKey = getAddharConsentResult.data.access_key

//                         const getAddharOtpResult = await getAdhaarOTP(aadharNumber, accessKey, mobile_number)
//                         console.log('getAddharOtpResult else part',getAddharOtpResult)
//                            //check otp send from aadhar or from user
//                            if(getAddharOtpResult.response_status_id === 0){
//                             otpMessage = getAddharOtpResult.data.message
//                             otpType = 'Addhar',
//                             access_key = getAddharOtpResult.data.access_key

//                             const uniqueId = uuid.v4();
//                             const dateValue = moment().format('YYYY-MM-DD HH:mm:ss')
 
//                               // Insert data into login_data table
//                 const [value] = await connection.query(
//                     "INSERT INTO auths (user_type, unique_id, mobile, status,createdAt,updatedAt,timestamp) VALUES (?, ?, ?, ?,?,?,?)",
//                     [user_type, uniqueId, mobile_number, "6", dateValue, dateValue, new Date()]
//                 );
//                 console.log(value);                
//                 // Send OTP to user mobile
//                 // Send OTP to user mobile
//                 // await smsapi("admin", "merchant_on_boarding", mobile_number, otp, `3 min`);

//                             return res.status(200).json({
//                                 status_code: "20",
//                                 status: "success",
//                                 unique_id: uniqueId,
//                                 message: "OTP Successfully Send to CSP/Merchant Mobile Number.",
//                                 otpType,
//                                 otpMessage,
//                                 access_key
//                                 // 
//                                 // getAddharOtpResult
//                             });
    
//                            }else{
//                              return res.send({  
//                              status_code: "20",
//                              status: "Failed",
//                              message:getAddharOtpResult.message })
//                            }
//                          }
//                 }else{
//                     console.log('inside else part false aadhar')
//                 // User not found, generate Unique Id and OTP
//                 const uniqueId = uuid.v4();
//                 const otp = Math.floor(100000 + Math.random() * 900000).toString();
//                 const saltedOTP = SALT.concat(otp);
//                 console.log(otp)
//                 // const hashedOTP = md5(saltedOTP);
//                 const hashedOTP = await hashOtp(otp) ;
//                 const dateValue = moment().format('YYYY-MM-DD HH:mm:ss')
        
//                 // Insert data into login_data table
//                 const [value] = await connection.query(
//                     "INSERT INTO auths (user_type, unique_id, mobile, status, otp,createdAt,updatedAt,timestamp) VALUES (?, ?, ?, ?, ?,?,?,?)",
//                     [user_type, uniqueId, mobile_number, "6", hashedOTP, dateValue, dateValue, new Date()]
//                 );
//                 // console.log(value);
          
                
//                 // Send OTP to user mobile
//                 // Send OTP to user mobile
//                 let mobile = mobile_number;
//                         smsapi("admin", "onboarding_code", mobile, otp, `3 min`);
//                 // await smsapi("admin", "merchant_on_boarding", mobile_number, otp, `3 min`);

//                 connection.release();
//                 return res.status(200).json({
//                     status_code: "20",
//                     status: "success",
//                     unique_id: uniqueId,
//                     "otpType": "ourSide",
//                     message: "OTP Successfully Sent to Merchant Mobile Number.",
//                 });
//             }
//           } 
//         }
//         else
//         {
//             return res.status(404).json({
//                 status_code: "2",
//                 status: "failed",
//                 message: "User Type must be csp or merchant",
//             });
//         }
//     } catch (error) {
//          console.error(error.message);
//         return res.status(500).json({
//             status_code: "2",
//             status: "failed",
//             message: "Internal Server Error",
//         });
//     }finally {
//         connection.release();
//     }
// });
router.post("/search-merchant", requireStaffLogin, async (req, res) => {


  const connection = await poolPromise2().getConnection();
  const connection2 = await poolPromise().getConnection();
  try {
      const {
          mobile_number,
          aadhar_number,
          package_id
      } = req.body;

      let user_type = "csp"

      // return res.send({status : 'failed', message:'env result ', data  :process.env.aadharVerificaton})
      let unique_id = req.id;
      if (user_type === "csp") {
          const [userResult] = await connection.query(
              "SELECT * FROM auths WHERE user_type = ? AND mobile = ? and aadhar_number = ?",
              [user_type, mobile_number, aadhar_number]
          );

          if (userResult.length > 0) {

              const user = userResult[0];
              console.log(user.id);

              switch (user.status) {
                  case "6":
                  case "5":
                      const otp = Math.floor(100000 + Math.random() * 900000).toString();
                      const saltedOTP = SALT.concat(otp);
                      const hashedOTP = md5(saltedOTP);

                      await connection.query("UPDATE auths SET otp = ? WHERE id = ?", [
                          hashedOTP,
                          user.id,
                      ]);

                      if (process.env.aadharVerificaton === "true") {
                          var otpMessage = ''
                          var otpType = ''
                          var access_key = ''
                          const getAddharConsentResult = await getAdhaarConsent(mobile_number)

                          if (getAddharConsentResult?.data?.access_key) {
                              let accessKey = getAddharConsentResult.data.access_key
                              const getAddharOtpResult = await getAdhaarOTP(aadhar_number, accessKey, mobile_number)
                              ''
                              //check otp send from aadhar or from user
                              if (getAddharOtpResult.response_status_id === 0) {
                                  otpMessage = getAddharOtpResult.data.message
                                  otpType = 'Addhar',
                                      access_key = getAddharOtpResult.data.access_key

                                  // const uniqueId = uuid.v4();
                                  const dateValue = moment().format('YYYY-MM-DD HH:mm:ss')

                                  const otp = Math.floor(100000 + Math.random() * 900000).toString();
                                  const saltedOTP = SALT.concat(otp);
                                  const hashedOTP = md5(saltedOTP);
                                  return res.status(200).json({
                                      status_code: "20",
                                      status: "success",
                                      unique_id:user.unique_id,
                                      message: "OTP Successfully Send to CSP/Merchant Mobile Number.",
                                      otpType,
                                      otpMessage,
                                      access_key
                                      // 
                                      // getAddharOtpResult
                                  });

                              } else {
                                  if (getAddharOtpResult.response_status_id === 1) {
                                      if (getAddharOtpResult.response_type_id === 1710) {
                                          return res.status(400).json({
                                              status_code: "2",
                                              status: "failed",
                                              message: "Incorrect Aadhar Number",


                                          });
                                      }
                                      if (getAddharOtpResult.response_type_id === 1620) {
                                          otpMessage = 'Otp send From OurSide'
                                          otpType = 'ourSide'
                                          smsapi("admin", "onboarding_code", mobile_number, "CSP", otp, `3 min`);
                                          await connection.query("UPDATE auths SET mobile_number = ? WHERE unique_id = ?", [mobile_number, user.unique_id]);
                                          return res.status(200).json({
                                              status_code: "20",
                                              status: "success",
                                              message: otpMessage,
                                              unique_id: user.unique_id,
                                              aadhar_number,
                                              otpType,
                                              access_key,

                                          });
                                          return res.status(200).json({
                                              status_code: "20",
                                              status: "success",
                                              message: otpMessage,
                                              unique_id,
                                              otpType,
                                              otpMessage,
                                              access_key

                                          });
                                      }
                                  }
                              }
                          } else {
                              return res.json({
                                  status_code: "2",
                                  status: "failed",
                                  message: "Incorrect Aadhar Number"
                              })
                          }
                      } else {
                          console.log('inside else part false aadhar')
                          // User not found, generate Unique Id and OTP
                          const unique_id = uuid.v4();
                          const otp = Math.floor(100000 + Math.random() * 900000).toString();
                          const saltedOTP = SALT.concat(otp);
                          console.log(otp)
                          // const hashedOTP = md5(saltedOTP);
                          const hashedOTP = await hashOtp(otp);
                          const dateValue = moment().format('YYYY-MM-DD HH:mm:ss')

                          // // Insert data into login_data table
                          // const [value] = await connection.query(
                          //   "INSERT INTO auths (user_type, unique_id, mobile, status, otp, timestamp) VALUES (?, ?, ?, ?,?,?)",
                          //   [user_type, uniqueId, mobile_number, "6", hashedOTP, new Date()]
                          // );
                          // console.log(value);
                          await connection.query("INSERT INTO auths SET ?", {
                              user_type,
                              unique_id,
                              mobile: mobile_number,
                              otp: hashedOTP,
                              status: "6",
                              timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
                              // customer_id: Math.floor(100000 + Math.random() * 900000).toString(),
                              // application_id: Math.floor(100000 + Math.random() * 900000).toString(),
                              aadhar_number,
                              // createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
                              // updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
                              package_id
                          });

                          // Send OTP to user mobile
                          // Send OTP to user mobile
                          let mobile = mobile_number;
                          smsapi("admin", "onboarding_code", mobile, otp, `3 min`);
                          // await smsapi("admin", "merchant_on_boarding", mobile_number, otp, `3 min`);
                          await connection.query("INSERT INTO mappings SET ?", {
                              unique_id,
                              time_stamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
                              created_by: req.staff.emp_id,
                              distributor_id: req.staff.unique_id,
                              agent_id: req.staff.unique_id,
                              asm_id: req.staff.am_id
                          })
                          connection.release();
                          return res.status(200).json({
                              status_code: "20",
                              status: "success",
                              unique_id: uniqueId,
                              "otpType": "ourSide",
                              message: "OTP Successfully Sent to Merchant Mobile Number.",
                          });
                      }

                  case "4":
                      connection.release();
                      return res.status(200).json({
                          status_code: "22",
                          status: "kyc pending",
                          message: "Onboard Merchant KYC.",
                          unique_id: user.unique_id,
                      });

                  case "3":
                      connection.release();
                      return res.status(200).json({
                          status_code: "23",
                          status: "Pending",
                          message: "Service Activation is Pending",
                          unique_id: user.unique_id,
                      });

                  case "2":
                      connection.release();
                      return res.status(200).json({
                          status_code: "2",
                          status: "Failed",
                          message: `User Type ${user.user_type} is Already Registered`,
                      });

                  case "1":
                      connection.release();
                      return res.status(200).json({
                          status_code: "2",
                          status: "Failed",
                          message: `User Type ${user.user_type} is Already Registered`,
                      });

                  case "0":
                      connection.release();
                      return res.status(200).json({
                          status_code: "2",
                          status: "Failed",
                          message: `User Type ${user.user_type} is Suspended`,
                      });
              }
              return res.status(200).json({
                  data: user
              });


          } else {
              //

              const [stock_result] = await connection2.query("SELECT * FROM stock where purchase_id = ?", [package_id]);
              if (stock_result.length === 0) {
                  return res.json({
                      status_code: "2",
                      status: "failed",
                      message: "Product does not exist"
                  })
              }
              if (stock_result[0].quantity === 0) {
                  return res.json({
                      status_code: "2",
                      status: "failed",
                      message: "Insufficient quantity in stock"
                  })
              }

              let unique_id_value = uuid.v4();
              const [stock_value] = await connection2.query("SELECT * FROM stock WHERE purchase_id = ?", [package_id]);
              const [debit_stock] = await connection2.query("UPDATE stock SET quantity = quantity - ? WHERE purchase_id = ?", [1, package_id]);
              const order_id =
                  Math.floor(1000 + Math.random() * 9000).toString() + Date.now();
              const created_on = moment().format("YYYY-MM-DD HH:mm:ss");
              await connection2.query(
                  "INSERT INTO stock_summary ( order_id, unique_id, transaction_type, transaction_at, product_id, opening_stock, quantity, closing_stock, description) VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                  [
                      order_id,
                      unique_id_value,
                      "Debit",
                      created_on,
                      package_id,
                      stock_value[0].quantity,
                      1,
                      stock_value[0].quantity - 1,
                      `1 stock Debit Successfully`,
                  ]
              );
              if (debit_stock.affectedRows === 1) {


                  if (process.env.aadharVerificaton === "true") {
                      console.log('env addhar veification is true')

                      var otpMessage = ''
                      var otpType = ''
                      var access_key = ''
                      const getAddharConsentResult = await getAdhaarConsent(mobile_number)
                      console.log('getAddahrConsentResult in else part', getAddharConsentResult)

                      if (getAddharConsentResult?.data?.access_key) {
                          let accessKey = getAddharConsentResult.data.access_key

                          const getAddharOtpResult = await getAdhaarOTP(aadhar_number, accessKey, mobile_number)
                          console.log('getAddharOtpResult else part', getAddharOtpResult)
                          //check otp send from aadhar or from user
                          if (getAddharOtpResult.response_status_id === 0) {
                              otpMessage = getAddharOtpResult.data.message
                              otpType = 'Addhar',
                                  access_key = getAddharOtpResult.data.access_key

                              // const uniqueId = uuid.v4();
                              const dateValue = moment().format('YYYY-MM-DD HH:mm:ss')
                              const unique_id = uuid.v4();
                              const otp = Math.floor(100000 + Math.random() * 900000).toString();
                              const saltedOTP = SALT.concat(otp);
                              const hashedOTP = md5(saltedOTP);

                              // Insert data into login_data table
                              // const [value] = await connection.query(
                              //   "INSERT INTO auths (user_type, unique_id, mobile, status,createdAt,updatedAt,timestamp) VALUES (?, ?, ?, ?,?,?,?)",
                              //   [user_type, uniqueId, mobile_number, "6", dateValue, dateValue, new Date()]
                              // );
                              // console.log(value);
                              console.log(otp)
                              await connection.query("INSERT INTO auths SET ?", {
                                  user_type,
                                  unique_id,
                                  mobile: mobile_number,
                                  otp: hashedOTP,
                                  status: "6",
                                  timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
                                  // customer_id: Math.floor(100000 + Math.random() * 900000).toString(),
                                  // application_id: Math.floor(100000 + Math.random() * 900000).toString(),
                                  aadhar_number,
                                  // createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
                                  // updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
                                  package_id
                              });
                              let unique_id_value = uuid.v4();
                              await connection.query("INSERT INTO mappings SET ?", {
                                  unique_id: unique_id_value,
                                  time_stamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
                                  created_by: req.staff.emp_id,
                                  distributor_id: req.staff.unique_id,
                                  agent_id: req.staff.unique_id,
                                  asm_id: req.staff.am_id
                              })
                              // Send OTP to user mobile
                              // Send OTP to user mobile
                              // await smsapi("admin", "merchant_on_boarding", mobile_number, otp, `3 min`);

                              return res.status(200).json({
                                  status_code: "20",
                                  status: "success",
                                  unique_id,
                                  message: "OTP Successfully Send to CSP/Merchant Mobile Number.",
                                  otpType,
                                  otpMessage,
                                  access_key
                                  // 
                                  // getAddharOtpResult
                              });

                          } else {
                              if (getAddharOtpResult.response_status_id === 1) {
                                  if (getAddharOtpResult.response_type_id === 1710) {


                                      const [stock_value] = await connection2.query("SELECT * FROM stock WHERE purchase_id = ?", [package_id]);
                                      const [debit_stock] = await connection2.query("UPDATE stock SET quantity = quantity + ? WHERE purchase_id = ?", [1, package_id]);
                                      const order_id =
                                          Math.floor(1000 + Math.random() * 9000).toString() + Date.now();
                                      const created_on = moment().format("YYYY-MM-DD HH:mm:ss");
                                      let unique_id_value = uuid.v4();
                                      await connection2.query(
                                          "INSERT INTO stock_summary ( order_id, unique_id, transaction_type, transaction_at, product_id, opening_stock, quantity, closing_stock, description) VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                                          [
                                              order_id,
                                              unique_id_value,
                                              "Credit",
                                              created_on,
                                              package_id,
                                              stock_value[0].quantity,
                                              1,
                                              stock_value[0].quantity + 1,
                                              `1 stock Credit Successfully`,
                                          ]
                                      );

                                      return res.status(400).json({
                                          status_code: "2",
                                          status: "failed",
                                          message: "Incorrect Aadhar Number",


                                      });
                                  }
                                  if (getAddharOtpResult.response_type_id === 1620) {
                                      otpMessage = 'Otp send From OurSide'
                                      otpType = 'ourSide'
                                      smsapi("admin", "onboarding_code", mobile_number, "CSP", otp, `3 min`);
                                      const unique_id = uuid.v4();
                                      const otp = Math.floor(100000 + Math.random() * 900000).toString();
                                      const saltedOTP = SALT.concat(otp);
                                      const hashedOTP = md5(saltedOTP);
                                      await connection.query("INSERT INTO auths SET ?", {
                                          user_type,
                                          unique_id,
                                          mobile: mobile_number,
                                          otp: hashedOTP,
                                          status: "6",
                                          timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
                                          // customer_id: Math.floor(100000 + Math.random() * 900000).toString(),
                                          // application_id: Math.floor(100000 + Math.random() * 900000).toString(),
                                          aadhar_number,
                                          // createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
                                          // updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
                                          package_id
                                      });
                                      let unique_id_value = uuid.v4();

                                      await connection.query("INSERT INTO mappings SET ?", {
                                          unique_id: unique_id_value,
                                          time_stamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
                                          created_by: req.staff.emp_id,
                                          distributor_id: req.staff.unique_id,
                                          agent_id: req.staff.unique_id,
                                          asm_id: req.staff.am_id
                                      })

                                      return res.status(200).json({
                                          status_code: "20",
                                          status: "success",
                                          message: otpMessage,
                                          unique_id,
                                          otpType,
                                          otpMessage,
                                          access_key

                                      });
                                  }
                              }
                          }
                      } else {
                          return res.json({
                              status_code: "2",
                              status: "failed",
                              message: "Incorrect Aadhar Number"
                          })
                      }
                  } else {
                      console.log('inside else part false aadhar')
                      // User not found, generate Unique Id and OTP
                      const unique_id = uuid.v4();
                      const otp = Math.floor(100000 + Math.random() * 900000).toString();
                      const saltedOTP = SALT.concat(otp);
                      console.log(otp)
                      // const hashedOTP = md5(saltedOTP);
                      const hashedOTP = await hashOtp(otp);
                      const dateValue = moment().format('YYYY-MM-DD HH:mm:ss')

                      // // Insert data into login_data table
                      // const [value] = await connection.query(
                      //   "INSERT INTO auths (user_type, unique_id, mobile, status, otp, timestamp) VALUES (?, ?, ?, ?,?,?)",
                      //   [user_type, uniqueId, mobile_number, "6", hashedOTP, new Date()]
                      // );
                      // console.log(value);
                      await connection.query("INSERT INTO auths SET ?", {
                          user_type,
                          unique_id,
                          mobile: mobile_number,
                          otp: hashedOTP,
                          status: "6",
                          timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
                          // customer_id: Math.floor(100000 + Math.random() * 900000).toString(),
                          // application_id: Math.floor(100000 + Math.random() * 900000).toString(),
                          aadhar_number,
                          // createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
                          // updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
                          package_id
                      });

                      // Send OTP to user mobile
                      // Send OTP to user mobile
                      let mobile = mobile_number;
                      smsapi("admin", "onboarding_code", mobile, otp, `3 min`);
                      // await smsapi("admin", "merchant_on_boarding", mobile_number, otp, `3 min`);
                      await connection.query("INSERT INTO mappings SET ?", {
                          unique_id,
                          time_stamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
                          created_by: req.staff.emp_id,
                          distributor_id: req.staff.unique_id,
                          agent_id: req.staff.unique_id,
                          asm_id: req.staff.am_id
                      })
                      connection.release();
                      return res.status(200).json({
                          status_code: "20",
                          status: "success",
                          unique_id: uniqueId,
                          "otpType": "ourSide",
                          message: "OTP Successfully Sent to Merchant Mobile Number.",
                      });
                  }
              } else {
                  return res.json({
                      status_code: "2",
                      status: "failed",
                      message: "Unable to debit stock"
                  })
              }
          }
      } else {
          return res.status(404).json({
              status_code: "2",
              status: "failed",
              message: "User Type must be csp or merchant",
          });
      }
  } catch (error) {
      console.error(error.message);
      return res.status(500).json({
          status_code: "2",
          status: "failed",
          message: "Internal Server Error",
      });
  } finally {
      connection.release();
  }
});



router.post("/csp-otp-verification", requireStaffLogin, async (req, res) => {
  const connection = await poolPromise2().getConnection();
  try {
    const {
      unique_id,
      otp,
      aadhar_number,
      access_key,
      otpType,
    } = req.body;
    const emp_id = req.staff.emp_id;
    console.log("req.staff", req.staff); // Log req.staff to verify it exists

    // Check if the user exists with the given unique id
    const [userResult] = await connection.query(
      "SELECT * FROM auths WHERE unique_id = ?",
      [unique_id]
    );

    if (userResult.length === 0) {
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message: "User not found.",
      });
    }

    const user = userResult[0];

    if (user.status === "5") {
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message: "Merchant already verified.",
      });
    }

    // Validate OTP
    // const saltedOTP = SALT.concat(otp);
    // const hashedOTP = md5(saltedOTP);

    if (otpType.toLowerCase() === "addhar") {
      // Handle Aadhar OTP verification
      if (!access_key) {
        return res.status(200).json({
          status_code: "2",
          status: "failed",
          message: "access_key not provided",
        });
      }
      const getAadharFileResult = await getAdhaarFile(
        aadhar_number,
        otp,
        access_key
      );
      if (getAadharFileResult.response_status_id === 0) {
        // Update customer_id, application_id, and status in auths_data table
        const application_id = Date.now();
        const customer_id =
          String(emp_id).slice(0, 4) +
          Math.floor(10000 + Math.random() * 90000).toString();

        await connection.query(
          "UPDATE `auths` SET  status = ? WHERE unique_id = ?",
          ["5", unique_id]
        );

        return res.status(200).json({
          status_code: "21",
          status: "success",
          data: {
            unique_id,
            name: getAadharFileResult.data.name,
            dob: getAadharFileResult.data.dob,
            gender: getAadharFileResult.data.gender,
            aadhar_number,
            residential_address: getAadharFileResult.data.combinedAddress,
          },
        });
      } else {
        return res.json({
          status_code: "2",
          status: "failed",
          message: "Incorrect OTP",
        });
      }
    } else if (otpType.toLowerCase() === "ourside") {
      // Handle OTP verification
      const [userData] = await connection.query(
        "SELECT * FROM auths WHERE unique_id = ? AND otp = ?",
        [unique_id, md5(SALT.concat(otp))]
      );

      if (userData.length === 0) {
        return res.status(200).json({
          status_code: "2",
          status: "failed",
          message: "Invalid OTP.",
        });
      }

      // OTP is successfully verified, generate customer id and update status in auths_data table
      const application_id = Date.now();
      const customer_id =
        String(emp_id).slice(0, 4) +
        Math.floor(10000 + Math.random() * 90000).toString();

      await connection.query(
        "UPDATE `auths` SET  status = ? WHERE unique_id = ?",
        ["5", unique_id]
      );

      return res.status(200).json({
        status_code: "21",
        status: "success",
        message: "Onboard Merchant.",
        data: {
          unique_id,
          name: "",
          dob: "",
          gender: "",
          aadhar_number,
          residential_address: "",
        },
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
    connection.release();
  }
});

    

router.post("/merchant-onboard", requireStaffLogin, async (req, res) => {
  //package -> stock quantity - 1
  const connection2 = await poolPromise2().getConnection(); // neopartner
  const connection = await poolPromise().getConnection();
    try {
        // const {
        //     unique_id,
        //     name,
        //     email,
        //     gender,
        //     date_of_birth,
        //     pan_number,
        //     aadhar_number,
        //     residential_address,
        //     entity_type,
        //     shop_name,
        //     office_address,
        //     package_id,
        // } = req.body;
        const { unique_id, name, dob, gender, aadhar_number, email, pan_number, residential_address, entity_type, shop_name, office_address, package_id } = req.body;
                 
       
      let   date_of_birth = dob
      
       
        // JSON.stringify(combinedAddress),
       

         const application_id = Date.now();
        const customer_id =
            String(req.staff.emp_id).slice(0, 4) +
        Math.floor(10000 + Math.random() * 90000).toString();
        async function convertAddress(addressString) {
          const parts = addressString.split(", ");
          // const [area, district, city, state] = parts;
          console.log(parts);
          let pincode = parts[parts.length - 1];
          let area = null;
          let district = null;
          let state = null;
          let city = null;
          let line = parts.slice(0, 3).join(',');

          
          const [pincode_data] = await connection.query("SELECT * FROM area where pincode = ?", [pincode]);
          if (pincode_data.length > 0)
          {
            area = pincode_data[0].name;
            district = pincode_data[0].district;
            state = pincode_data[0].state;
            area = pincode_data[0].name;
            parts.reverse().forEach(element => {
              if ((element.toLowerCase() !== area.toLowerCase()) &&
                (element.toLowerCase() !== state.toLowerCase()) &&
                (element.toLowerCase() !== district.toLowerCase()) &&
                (element !== pincode)) 
                {
                  city = element
                }
            });
          }
          else
          {
            pin_data = await pin_code(Number(pincode));
            console.log(pin_data);
            area = pin_data[0].name;
            district = pin_data[0].district;
            state = pin_data[0].state;
            area = pin_data[0].name;
            parts.reverse().forEach(element => {
              if ((element.toLowerCase() !== area.toLowerCase()) &&
                (element.toLowerCase() !== state.toLowerCase()) &&
                (element.toLowerCase() !== district.toLowerCase()) &&
                (element !== pincode)) 
                {
                  city = element
                }
            })
          
          }
          if (line.substr(0, 5) === city.substr(0, 5))
          {
            city = parts[4]
            }
          return {
              "line": line,
              "city": city,
              "state": state,
              "pincode": pincode,
              "area": area,
              "district":district
          };
      }
      
        // Insert data into login_data and retailer tables
        //await connection2.beginTransaction();
       
        // Check if the user exists with the given unique id
        const [userResult] = await connection2.query(
            "SELECT * FROM auths WHERE unique_id = ?",
            [unique_id]
        );
        console.log(userResult);
        if (userResult.length === 0) {
            connection2.release();
            return res.status(200).json({
                status_code: "2",
                status: "failed",
                message: "User not found",
            });
        }
       

        const user = userResult[0];
      
        if (parseInt(user.status) !== 5)
        {
            return res.status(422).json({
                status_code:"2",
                status: "failed",
                message:"Status undefined"
            })
        }


        // check for duplicate adhar or pancard 
        //Check if aadhar or pancard exist 
        const [adhar_pan_detail] = await connection2.query(
            "SELECT * FROM merchants WHERE aadhar_no = ? OR pan_number = ?",
            [aadhar_number, pan_number]
        );
        console.log('adhar_pan_detail',adhar_pan_detail);
        if (adhar_pan_detail.length !== 0) {
            return res.status(422).json({
                status_code: "2",
                status: "failed",
                message: "Duplicate values are not allowed",
            });
        }

     
      console.log(process.env.callEko);
      // check value
      if (process.env.eko_user_onboard === "true") {
        try {
          const {
            secretKey,
            Timestamp: timestamp
          } = await getSecretKeyAndTimeStamp();
          let addressformat = await convertAddress(residential_address);
          // return res.json({o: process.env.eko_user_onboard})
          const details = {
            pan_number,
            name,
            email,
           residential_address: addressformat,
            date_of_birth,
            shop_name,
            secretKey,
            timestamp
          }
        
         
          const { requestDetails, details_data } = await checkDetails(details);

          // return res.json({
          //   requestDetails,details_data
          // })
                
            //  return res.json({requestDetails,details_data})

                if (details_data) {
                    // await connection.query(
                    //     "INSERT INTO `eko_api_log`(`timestamp`, `api_name`, `request`, `response`) VALUES (?, ?, ?, ?);",
                    //     [
                    //         moment().format('YYYY-MM-DD HH:mm:ss'),
        
                    //         requestDetails.url,
                    //         JSON.stringify(requestDetails),
                    //         JSON.stringify(details_data),
                            
                    //     ]
                    // );
                   
                    // return res.json({details_data})
                    if (details_data['response_status_id'] !== -1)
                    {
                        
                        return res.status(422).json({
                         status_code:"2",
                         status:"failed",
                         message:"Invalid pan number"
                     });
                    // return res.status(200).json(details_data);
                  }
                    else
                    {
                      if (details_data["status"] === 0)
                      {
                        
                        
                        if (process.env.virtual_account === "true")
                        {
                          // collect bank code
                          // return res.json({details_data})

                          const ekoOnboardResponse = await savevirtualaccount(
                            req,
                            res,
                            user.unique_id,
                            user.trade_name || "no data", // need to change
                            pan_number,
                            residential_address // need to change
                          );

                          return res.json({
                            ekoOnboardResponse
                          })
                          // Check if Third-Party API response is successful (status 0)
                          if (ekoOnboardResponse.status !== 0)
                          {
                            connection2.release();
                            return res.status(200).json({
                              status_code: "2",
                              status: "failed",
                              message: "CSP onboarding failed with Third-Party API",
                            });
                          } 
                          // INsert into virtual Account Table
                          // INsert it into merchant table
                          // scheme summary
                          //user serverice talbe

                        }
                      }
                  }
                }

               
            } catch (err) {
                return res.status(500).json({
                    status_code: "2",
                    status: "failed",
                    message: "Internal Server Error",
                });
            }

        }
        else
        {
          
        }

        //Check if package exist 
        const [packageDetailss] = await connection2.query(
            "SELECT * FROM schemes WHERE userType = ? AND package_id = ?",
            [user.user_type, package_id]
        );
        console.log(user);
        if (packageDetailss.length === 0) {
            return res.status(404).json({
                status_code: "2",
                status: "failed",
                message: "Data not found for given  package_id",
            });
        }

        const [merchants] = await connection2.query(
            "SELECT * FROM merchants WHERE unique_id = ? ",
            [user.unique_id]
        );

        if (merchants.length > 0) {
            return res.status(422).json({
                status_code: "2",
                status: "failed",
                message: "Merchant already boarded"
            });
        }
        const auth_time = moment().format('YYYY-MM-DD HH:mm:ss')
        // Insert into login_data table
        await connection2.query(
            "UPDATE auths SET status = ?, package_id = ?, updatedAt = ? WHERE id = ?",
            ["4", package_id, auth_time,user.id]
        );
const dateValue = moment().format('YYYY-MM-DD HH:mm:ss')
        // Insert into retailer table
        await connection2.query(
    "INSERT INTO merchants (unique_id, application_id, gender,customer_id, authorized_person_name, email, date_of_birth, pan_number, aadhar_no, residential_address, entity_name, entity_type, office_address, status, createdAt, updatedAt, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?, ?, ?, ?)",
    [
        unique_id,
        application_id,
        gender,
        customer_id,
        name,
        email,
        date_of_birth,
        pan_number,
        aadhar_number,
        JSON.stringify(combinedAddress),
        shop_name,
        entity_type,
        JSON.stringify(office_address),
        "KYC-Not Submitted",
        dateValue,
        dateValue,
        dateValue
    ]
);



        const packageDetails = packageDetailss[0];

            const scheme_time = moment().format('YYYY-MM-DD HH:mm:ss')
        // Insert into schemesummarys table

        function generateYearMonth() {
            const now = new Date();
            const year = now.getFullYear();
            const month = (now.getMonth() + 1).toString().padStart(2, "0");
            return `${year}${month}`;
          }
          const yearMonth = generateYearMonth();
          let reference_id = yearMonth + Number(7654321);
      
          
        await connection2.query(
            "INSERT INTO schemesummarys (tran_at, order_id, unique_id, customer_id, packid, packname, price, gst, total, status, validity,createdAt,updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?)",
            [
                new Date(),
                reference_id,
                user.unique_id,
               customer_id,
                package_id,
                packageDetails.packname,
                packageDetails.price,
                packageDetails.gst,
                packageDetails.total,
                "Pending",
                packageDetails.duration,
                scheme_time,
                scheme_time
            ]
        );

        const [serviceData] = await connection2.execute(
            "SELECT * FROM service_with_packages WHERE packages_id = ?",
            [package_id]
        );

        if (!serviceData.length) {
            connection2.release();
            return res.status(500).json({
                success: false,
                message: "No services found for this package",
            });
        }

        const userData = serviceData.map((item) => [
            user.unique_id,
            item.packages_id,
            item.services_id,
            item.status,
            item.packages_name,
            item.services_name,
            new Date(), // createdAt
            new Date() // updatedAt
        ]);

        await connection2.query(
            "INSERT INTO user_services (unique_id, packages_id, service_id, status, `packages_name`, `service_name`,createdAt,updatedAt) VALUES ?",
            [userData]
        );
        
        
        
        const wallet_time = moment().format('YYYY-MM-DD HH:mm:ss')
        // Insert into wallet table
        await connection2.query(
            "INSERT INTO wallets (user_type, unique_id, wallet, hold, unsettle, status,createdAt,updatedAt) VALUES (?, ?, ?, ?, ?, ?,?,?)",
            [user.user_type, user.unique_id, 0, 0, 0, "Enable",wallet_time,wallet_time]
        );

        await connection2.commit();
        connection2.release();

        return res.status(200).json({
            status_code: "22",
            status: "success",
            unique_id,
            message: "Merchant successfully onboarded",
        });
    } catch (error) {
        console.error(error);
        await connection2.rollback();
        connection2.release();
        return res.status(500).json({
            status_code: "2",
            status: "failed",
            message: "Internal Server Error",
        });
    }
});

// router.post("/onboard-merchant-kyc", requireLogin,
//     upload3.fields([{
//             name: "photo",
//             maxCount: 1
//         },
//         {
//             name: "pan_front",
//             maxCount: 1
//         },
//         {
//             name: "aadhar_front",
//             maxCount: 1
//         },
//         {
//             name: "aadhar_back",
//             maxCount: 1
//         },
//          {
//             name: "shop_photo",
//             maxCount: 1
//         },
//     ]),
//     async (req, res) => {
//         console.log('coming inside');
//         const connection = await poolPromise2().getConnection();

//         try {
//             const {
//                 unique_id
//             } = req.body;

//             if(!unique_id){
//                 return res.send({statuscode:2, status:'failed', message:'please send unique_id in body along with other documents'})
//             }

//             // Check if the user exists with the given unique id
//             const [userResult] = await connection.query(
//                 "SELECT * FROM auths WHERE unique_id = ?",
//                 [unique_id]
//             );
//             console.log(userResult);
//             if (userResult.length === 0) {
//                 connection.release();
//                 return res.status(200).json({
//                     status_code: "2",
//                     status: "failed",
//                     message: "User not found",
//                 });
//             }
//             if (!req.files) {
//                 connection.release();
//                 return res.status(422).json({
//                     status_code: "2",
//                     status: "failed",
//                     message: "No files found",
//                 });
//             }

//             const user = userResult[0];
//           console.log('req files',req.files)
//             // Check if files were uploaded

//             if (!req.files || Object.keys(req.files).length === 0) {
//                 return res.status(400).send({ statuscode : 2, status: 'failed', message: 'No files were uploaded. send photo ,pan_front ,aadhar_front ,aadhar_back ,shop_photo'});
//             }

//             const requiredFiles = ['photo','pan_front', 'aadhar_front', 'aadhar_back','shop_photo'];
//             const missingFiles = requiredFiles.filter(file => !req.files[file]);
        
//             if (missingFiles.length > 0) {
//                 return res.status(400).send({ statuscode : 2, status: 'failed', message: `Missing files: ${missingFiles.join(', ')}`});
//             }

       

//             const panFrontPath = req.files["pan_front"][0].filename;
//             const aadharFrontPath = req.files["aadhar_front"][0].filename;
//             const aadharBackPath = req.files["aadhar_back"][0].filename;
           
//             const shop_photo = req.files["shop_photo"][0].filename;

//             const merchant_time = moment().format('YYYY-MM-DD HH:mm:ss')
//           await connection.query(
//     "UPDATE merchants SET photo = ?, shop_photo = ?, pan_front = ?, aadhar_front = ?, aadhar_back = ?, status = ?, updatedAt = ? WHERE unique_id = ?",
//     [
//         panFrontPath,
//          shop_photo,

//         panFrontPath,
//         aadharFrontPath,
//         aadharBackPath,
//         "KYC-Submit",
//         merchant_time,
//         user.unique_id,
//     ]
// );

//             const auth_time = moment().format('YYYY-MM-DD HH:mm:ss')
//             // Update status code in login_data table
//             await connection.query(
//                 "UPDATE auths SET status = ?, updatedAt = ? WHERE unique_id = ?",
//                 ["3",auth_time ,unique_id]
//             );

//             connection.release();

//             return res.status(200).json({
//                 status_code: "23",
//                 status: "success",
//                 unique_id,
//                 message: "Activated Merchant Services",
//             });
//         } catch (error) {
//             console.error(error);
//             connection.release();
//             return res.status(500).json({
//                 status_code: "2",
//                 status: "failed",
//                 message: "Internal Server Error",
//             });
//         }
//     }
// );

router.post("/onboard-merchant-kyc", requireStaffLogin, upload2.fields([{
  name: "photo",
  maxCount: 1
},
{
  name: "pan_front",
  maxCount: 1
},
{
  name: "aadhar_front",
  maxCount: 1
},
{
  name: "aadhar_back",
  maxCount: 1
},
{
  name: "board_resolution",
  maxCount: 1
},
{
  name: "registration_certificate",
  maxCount: 1
},
]),
async (req, res) => {
const connection = await poolPromise().getConnection();

try {
  const {
      unique_id
  } = req.body;

  const [loginDistributor] = await connection.query(
      "SELECT * FROM auths WHERE unique_id = ?",
      [unique_id]
  );


  if (loginDistributor.length === 0) {
      connection.release();
      return res.status(200).json({
          status_code: "2",
          status: "failed",
          message: "Merchant with the provided  id does not already exists.",
      });
  }
  // const unique_id = loginDistributor[0].unique_id;
  const isEmpty = Object.keys(req.files).length === 0;
  console.log(Object.keys(req.files))
  console.log(req.files)
  const mandatory_documents = Object.keys(req.files);
  const includesAll = mandatory_documents.includes('photo') && mandatory_documents.includes('pan_front')  && mandatory_documents.includes('aadhar_front') && mandatory_documents.includes('aadhar_back') 
  if (includesAll === false) {
      connection.release();
      return res.status(422).json({
          status_code: "2",
          status: "failed",
          message: "Please provide required files",
      });
  }
  // Check if the distributor with the given application id exists
  const [existingDistributor] = await connection.query(
      "SELECT * FROM merchants WHERE unique_id = ?",
      [unique_id]
  );
    
  if (existingDistributor.length === 0) {
      connection.release();
      return res.status(200).json({
          status_code: "2",
          status: "failed",
          message: "Merchants with the provided unique id does not exist.",
      });
  }
  

  // Upload KYC documents and get file paths
  const photoPath = req.files["photo"] ?
      req.files["photo"][0].filename :
      null;
  const panFrontPath = req.files["pan_front"] ?
      req.files["pan_front"][0].filename :
      null;
  const aadharFrontPath = req.files["aadhar_front"] ?
      req.files["aadhar_front"][0].filename :
      null;
  const aadharBackPath = req.files["aadhar_back"] ?
      req.files["aadhar_back"][0].filename :
      null;
  const boardResolutionPath = req.files["board_resolution"] ?
      req.files["board_resolution"][0].filename :
      null;
  const regCertificatePath = req.files["registration_certificate"] ?
      req.files["registration_certificate"][0].filename :
      null;

  // Update distributor data in the distributor table
  await connection.query(
      "UPDATE merchants SET photo = ?, pan_front = ?, aadhar_front = ?, aadhar_back = ?, board_resolution = ?, reg_certificate = ?, status = ? WHERE unique_id = ?",
      [
          photoPath,
          panFrontPath,
          aadharFrontPath,
          aadharBackPath,
          boardResolutionPath,
          regCertificatePath,
          "KYC-Pending",
          unique_id,
      ]
  );

  // Change status code in login_data table from 4 to 3
  await connection.query(
      "UPDATE auths SET status = ? WHERE unique_id = ?",
      ["3", unique_id]
  );

  connection.release();

  return res.status(200).json({
      status_code: "23",
      status: "success",
      unique_id,
      message: "Activated Merchant Service",
  });
} catch (error) {
  console.error(error);
  return res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Internal Server Error",
  });
} finally {
  connection.release();
}
}
);
router.post("/activated-services", requireLogin, async (req, res) => {
  //agent id
  // fse_id
  // mode_of_payment -> not required
  // sevice_id enabele user_Service_packages 41 
  // if enabled mobile number device
  // else
  //auths, skimsummary status
  
    const connection = await poolPromise2().getConnection();

    try {
        const {
            unique_id,
            model_name,
          device_number,
            agent_id,
            mode_of_payment,
        } =
        req.body;

        const emp_id = req.login.emp_id;

         // Simple validation
        const missingFields = [];
        if (!unique_id) missingFields.push('unique_id');
        // if (!model_name) missingFields.push('model_name');
        // if (!device_number) missingFields.push('device_number');
        if (!mode_of_payment) missingFields.push('mode_of_payment');

        if (missingFields.length > 0) {
            return res.status(400).send({ statuscode : 2, status: 'failed', message: `Mandatory fields are missing or empty: ${missingFields.join(', ')}`});
        }

        // Check if the user exists with the given unique id
        const [userResult] = await connection.query(
            "SELECT * FROM auths WHERE unique_id = ? ",
            [unique_id]
        );
        if (userResult.length === 0) {
            connection.release();
            return res.status(200).json({
                status_code: "2",
                status: "failed",
                message: "User not found",
            });
        }

        const user = userResult[0];

        if(user.status == 2){
            return res.send({statuscode : 2, status:'failed', message: 'Service Already Activated'})
        }
        
        if(user.status != 3){
            return res.send({statuscode:1, status:'failed', message:'user status is not 3 '})
        }

        // Check if service_id 41 is enabled for the user
        const [userServices] = await connection.query(
            "SELECT * FROM user_services WHERE  service_id = 38 AND status = ?",
            [ "Enable"]
        );
            
        if (userServices.length === 0) {
            // Insert data in mapping table
            const map_time = moment().format('YYYY-MM-DD HH:mm:ss')
            await connection.query(
                "INSERT INTO mappings (unique_id, services_type,time_stamp, application_id, created_by, asm_id,createdAt,updatedAt) VALUES (?,?, ?, ?, ?, ?,?,?) ",
                [user.unique_id, "None", map_time,user.unique_id, emp_id, emp_id,map_time,map_time]
            );
        } else {
            // Insert data in mapping table
            const map_time = moment().format('YYYY-MM-DD HH:mm:ss')

            if (userServices.length > 0 && (!model_name || !device_number)) {
                connection.release();
                return res.status(200).json({
                    status_code: "2",
                    status: "failed",
                    message: "Model Name and Device Number are missing.",
                });
            }

            await connection.query(
                "INSERT INTO mappings (unique_id, services_type, application_id, created_by, asm_id, model_name, device_number,createdAt,updatedAt) VALUES (?, ?, ?, ?, ?, ?,?,?,?) ",
                [
                    user.unique_id,
                    "AePS",
                    user.unique_id,
                    emp_id,
                    emp_id,
                    model_name,
                    device_number,
                    map_time,
                    map_time
                ]
            );
        }

        // Check if model_name and device_number are provided when the service is enabled
     
            const auth_time = moment().format('YYYY-MM-DD HH:mm:ss')
        // Update status code in login_data table
        await connection.query(
            "UPDATE auths SET status = ?, updatedAt = ? WHERE unique_id = ?",
            ["2", auth_time,unique_id]
        );

        const [scheme] = await connection.query(
            "SELECT * FROM schemes WHERE package_id = ?",
            [user.package_id]
        );

        const currentTimestamp = Date.now();
        const currentDate = new Date(currentTimestamp);
        const expiryDays = scheme[0].duration;
        const expiryTimestamp = currentTimestamp + expiryDays * 24 * 60 * 60 * 1000;
        const expiryDate = new Date(expiryTimestamp);

        const activedate = currentDate.toISOString().substring(0, 10);
        const expiredate = expiryDate.toISOString().substring(0, 10);

        if (mode_of_payment === "Cash" || mode_of_payment === "cash") {
            // Update status, active date, expire date in login_data table
            // (Only if mode of payment is Cash)
            await connection.query(
                "UPDATE schemesummarys SET status = ?, activedate = ?, expiredate = ? WHERE unique_id = ?",
                ["Success", activedate, expiredate, user.unique_id]
            );

            await connection.query(
                "UPDATE auths SET status = ?, package_expiry = ? WHERE unique_id = ?",
                ["2", expiredate, unique_id]
            );
            // Update status, active date, expire date in scheme summary table
          
        }
         const [merchantResult] = await connection.query(
            "SELECT * FROM merchants WHERE unique_id = ?",
            [unique_id]
        );
    
        const merchantValue = merchantResult[0];
        // smsapi("admin", "otp_send", mobile_number, otp, `3 min`);
        // onboarding_code

        smsapi("admin", "csp_on-boarded", user.mobile, merchantValue['authorized_person_name']);

        connection.release();

        return res.status(200).json({
            status_code: "1",
            status: "success",
            unique_id,
            message: "Services Activated successfully.",
        });
    } catch (error) {
        console.error(error);
        connection.release();
        return res.status(500).json({
            status_code: "2",
            status: "failed",
            message: "Internal Server Error",
        });
    }
});






router.post("/search-agent", requireLogin, async (req, res) => {
  const connection = await poolPromise().getConnection();
  try {
      const {
          mobile_number,
          aadhar_number
      } = req.body;
      const emp_id = req.login.customer_id;

      const [AgentData] = await connection.query(
          "SELECT * FROM login WHERE mobile_number = ? ",
          [mobile_number]
      );

      if (AgentData.length > 0) {
          const statusCode = AgentData[0].status;

          switch (statusCode) {
              case "6":
              case "5":
                  const otp = Math.floor(100000 + Math.random() * 900000).toString();
                  const saltedOTP = SALT.concat(otp);
                  const hashedOTP = md5(saltedOTP);

                  await connection.query("UPDATE login SET otp = ? WHERE id = ?", [
                      hashedOTP,
                      AgentData[0].id,
                  ]);

                  if (process.env.aadharVerificaton === "true") {
                      var otpMessage = '';
                      var otpType = '';
                      var access_key = '';

                      const getAddharConsentResult = await getAdhaarConsent(mobile_number);

                      if (getAddharConsentResult.data.access_key !== null) {
                          let accessKey = getAddharConsentResult.data.access_key;
                          const getAddharOtpResult = await getAdhaarOTP(aadhar_number, accessKey, mobile_number);

                          if (getAddharOtpResult.response_status_id === 0) {
                              otpMessage = getAddharOtpResult.data.message;
                              otpType = 'Addhar';
                              access_key = getAddharOtpResult.data.access_key;

                              return res.status(200).json({
                                  status_code: "20",
                                  status: "success",
                                  message: "OTP Successfully Send to Agent Mobile Number.",
                                  unique_id: AgentData[0].unique_id,
                                  aadhar_number,
                                  otpType,
                                  access_key,

                              });
                          } else {
                              if (getAddharOtpResult.response_status_id === 1) {
                                  await connection.query("UPDATE login SET status = ? WHERE id = ?", [
                                      "6",
                                      AgentData[0].id,
                                  ]);
                                  if (getAddharOtpResult.response_type_id === 1710) {
                                      return res.status(400).json({
                                          status_code: "2",
                                          status: "failed",
                                          message: "Incorrect Adhar number"
                                      });
                                  }
                                  if (getAddharOtpResult.response_type_id === 1620) {
                                      otpMessage = 'Otp send From OurSide';
                                      otpType = 'ourSide';
                                      smsapi("admin", "otp_send", mobile_number, otp, `3 min`);
                                      await connection.query("UPDATE login SET mobile_number = ? WHERE unique_id = ?", [mobile_number, AgentData[0].unique_id]);
                                      return res.status(200).json({
                                          status_code: "20",
                                          status: "success",
                                          message: otpMessage,
                                          unique_id: AgentData[0].unique_id,
                                          aadhar_number,
                                          otpType,
                                          access_key,

                                      });
                                  }
                              }
                          }
                      }
                  } else {
                      var otpMessage = '';
                      var otpType = '';
                      var access_key = '';

                      if (!otpMessage && !otpType && !access_key) {
                          otpMessage = 'Otp send From OurSide';
                          otpType = 'ourSide';
                          smsapi("admin", "otp_send", mobile_number, otp, `3 min`);
                      }

                      connection.release();
                      return res.status(200).json({
                          status_code: "15",
                          status: "pending",
                          message: otpMessage,
                          unique_id: AgentData[0].unique_id,
                          aadhar_number,
                          otpType,
                          access_key,

                      });
                  }
                  break;

                  // case "5":
                  //     // Agent Onboard is Pending
                  //     connection.release();
                  //     return res.status(200).json({
                  //         status_code: "16",
                  //         status: "pending",
                  //         application_id: AgentData[0].application_id,
                  //         message: "Agent Onboard is Pending.",
                  //     });

              case "4":
                  // Agent KYC is Pending
                  connection.release();
                  return res.status(200).json({
                      status_code: "22",
                      status: "success",
                      message: "Agent KYC is Pending.",
                      unique_id: AgentData[0].unique_id,
                  });

              case "3":
                  // Agent Territory assigned is Pending
                  connection.release();
                  return res.status(200).json({
                      status_code: "23",
                      status: "pending",
                      message: "Assign Agent Territory.",
                      unique_id: AgentData[0].unique_id,
                  });

              case "2":
              case "1":
                  // Agent Account is Active
                  connection.release();
                  return res.status(200).json({
                      status_code: "2",
                      status: "failed",
                      message: "Agent Account is Already Registered.",
                  });

              case "0":
                  // Suspended
                  connection.release();
                  return res.status(200).json({
                      status_code: "2",
                      status: "failed",
                      message: "Agent Account is Suspended.",
                  });

              default:
                  connection.release();
                  return res.status(200).json({
                      status_code: "2",
                      status: "failed",
                      message: "Invalid Account Status.",
                  });
          }
      }
      const [checkAdharDuplicate] = await connection.query("SELECT COUNT(*) as count FROM login WHERE aadhar_number = ?", [aadhar_number])
      if (checkAdharDuplicate[0].count > 0)
      {
          return res.json({
              status_code:"2",
              status: "failed",
              message:"Duplicate aadhar not allowed"
      })
      }
      
      const unique_id = uuid.v4();
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const saltedOTP = SALT.concat(otp);
      const hashedOTP = md5(saltedOTP);

      if (process.env.aadharVerificaton === "true") {
          var otpMessage = ''
          var otpType = ''
          var access_key = ''
          const getAddharConsentResult = await getAdhaarConsent(mobile_number);

          if (getAddharConsentResult?.data?.access_key) {
              let accessKey = getAddharConsentResult.data.access_key;
              const getAddharOtpResult = await getAdhaarOTP(aadhar_number, accessKey, mobile_number);

              if (getAddharOtpResult.response_status_id === 0) {

                  otpMessage = getAddharOtpResult.data.message
                  otpType = 'Addhar',
                      access_key = getAddharOtpResult.data.access_key
                  

                  await connection.query("INSERT INTO login SET ?", {
                      user_type: "Agent",
                      unique_id,
                      mobile_number: mobile_number,
                      otp: hashedOTP,
                      status: "6",
                      // customer_id: Math.floor(100000 + Math.random() * 900000).toString(),
                      // application_id: Math.floor(100000 + Math.random() * 900000).toString(),
                      aadhar_number,
                      created_date: new Date(),
                      created_by: emp_id,
                      am_id: emp_id,
                  });
                  return res.status(200).json({
                      status_code: "20",
                      status: "success",
                      message: "OTP Successfully Send to Agent Mobile Number.",
                      unique_id: unique_id,
                      aadhar_number,
                      otpType,
                     
                      access_key

                  });
              } else {
                  if (getAddharOtpResult.response_status_id === 1) {
                      if (getAddharOtpResult.response_type_id === 1710) {
                          return res.status(400).json({
                              status_code: "2",
                              status: "failed",
                              message: "Incorrect Aadhar Number",


                          });
                      }
                      if (getAddharOtpResult.response_type_id === 1620) {
                          otpMessage = 'Otp send From OurSide'
                          otpType = 'ourSide'
                        // smsapi("admin", "otp_send", mobile_number, otp, `3 min`);
                        smsapi("admin", "onboarding_otp", mobile_number, "Agent",otp, `3 min`);

                        

                          await connection.query("INSERT INTO login SET ?", {
                              user_type: "Agent",
                              unique_id: unique_id,
                              mobile_number: mobile_number,
                              otp: hashedOTP,
                              status: "6",
                              // customer_id: Math.floor(100000 + Math.random() * 900000).toString(),
                              // application_id: Math.floor(100000 + Math.random() * 900000).toString(),
                              aadhar_number,
                              created_date: new Date(),
                              created_by: emp_id,
                              am_id: emp_id,
                          });

                          return res.status(200).json({
                              status_code: "20",
                              status: "success",
                              message: otpMessage,
                              unique_id,
                              otpType,
                              otpMessage,
                              access_key

                          });
                      }
                  }
              }
          } else {
              var otpMessage = '';
              var otpType = '';
              var access_key = '';

              if (!otpMessage && !otpType && !access_key) {
                  otpMessage = 'Otp send From OurSide';
                  otpType = 'ourSide';
                // smsapi("admin", "otp_send", mobile_number, otp, `3 min`);
                smsapi("admin", "onboarding_otp", mobile_number, "Agent",otp, `3 min`);
                await connection.query("INSERT INTO login SET ?", {
                  user_type: "Agent",
                  unique_id: unique_id,
                  mobile_number: mobile_number,
                  otp: hashedOTP,
                  status: "6",
                  // customer_id: Math.floor(100000 + Math.random() * 900000).toString(),
                  // application_id: Math.floor(100000 + Math.random() * 900000).toString(),
                  aadhar_number,
                  created_date: new Date(),
                  created_by: emp_id,
                  am_id: emp_id,
              });
              }

              connection.release();
              return res.status(200).json({
                  status_code: "15",
                  status: "pending",
                  message: otpMessage,
                  unique_id: unique_id,
                  aadhar_number,
                  otpType,
                  access_key,

              });
          }
      } else {
          var otpMessage = '';
          var otpType = '';
          var access_key = '';

          if (!otpMessage && !otpType && !access_key) {
              otpMessage = 'Otp send From OurSide';
              otpType = 'ourSide';
            // smsapi("admin", "otp_send", mobile_number, otp, `3 min`);
            smsapi("admin", "onboarding_otp", mobile_number, "Agent",otp, `3 min`);
            await connection.query("INSERT INTO login SET ?", {
              user_type: "Agent",
              unique_id: unique_id,
              mobile_number: mobile_number,
              otp: hashedOTP,
              status: "6",
              // customer_id: Math.floor(100000 + Math.random() * 900000).toString(),
              // application_id: Math.floor(100000 + Math.random() * 900000).toString(),
              aadhar_number,
              created_date: new Date(),
              created_by: emp_id,
              am_id: emp_id,
          });
          }

          connection.release();
          return res.status(200).json({
              status_code: "15",
              status: "success",
              message: otpMessage,
              unique_id: unique_id,
              aadhar_number,
              otpType,
              access_key,


          });
      }
  } catch (error) {
      console.error(error.message);
      return res.status(500).json({
          status_code: "2",
          status: "failed",
          message: "Internal Server Error",
      });
  } finally {
      connection.release();
  }
});


router.post("/otp-verification", requireLogin, async (req, res) => {
  const connection = await poolPromise().getConnection();

  try {
      const {
          unique_id,
          otp,
          aadhar_number,
          otpType,
          access_key,
      } = req.body;
      const emp_id = req.login.customer_id;



      const [userData] = await connection.query(
          "SELECT * FROM login WHERE unique_id = ?",
          [unique_id]
      );

      if (userData.length === 0) {
          connection.release();
          return res.status(200).json({
              status_code: "2",
              status: "failed",
              message: "Invalid User",
          });
      } else {

          if (userData[0].status === "5") {
              connection.release();
              return res.status(200).json({
                  status_code: "2",
                  status: "failed",
                  message: "Agent already verified.",
              });
          }
      }

      if (otpType.toLowerCase() === "addhar")
      {
          if (!access_key)
          {
              return res.status(200).json({
                  status_code: "2",
                  status: "failed",
                  message: "access_key not provided"
              })
          }
          const getAadharFileResult = await getAdhaarFile(aadhar_number, otp, access_key);
          if (getAadharFileResult.response_status_id === 0) {

              const application_id = Date.now();
              const customer_id = String(emp_id).slice(0, 4) +
                  Math.floor(10000 + Math.random() * 90000).toString();

              // Update customer_id, application_id, and status in login_data table
              await connection.query(
                  "UPDATE `login` SET customer_id = ?, application_id = ?, status = ? WHERE unique_id = ?",
                  [customer_id, application_id, "5", unique_id]
              );



              console.log(userData[0].status);
              return res.status(200).json({
                  status_code: "21",
                  status: "success",
                  data: {
                      unique_id,
                      name: getAadharFileResult.data.name,
                      dob: getAadharFileResult.data.dob,
                      gender: getAadharFileResult.data.gender,
                      aadhar_number,
                      residential_address: getAadharFileResult.data.combinedAddress
                  }
              })
          }
          else
          {
              return res.json({
                  status_code: "2",
                  status: "failed",
                  message:"Incorrect OTP"
              })
          }
      } else {
          if (otpType.toLowerCase() === "ourside") {
              // Check if the OTP is valid
              const [userData] = await connection.query(
                  "SELECT * FROM login WHERE unique_id = ? AND otp = ?",
                  [unique_id, md5(SALT.concat(otp))]
              );

              if (userData.length === 0) {
                  connection.release();
                  return res.status(200).json({
                      status_code: "2",
                      status: "failed",
                      message: "Invalid OTP.",
                  });
              }

              // OTP is successfully verified, generate customer id and update status in login_data table

              const application_id = Date.now();
              const customer_id =
                  String(emp_id).slice(0, 4) +
                  Math.floor(10000 + Math.random() * 90000).toString();

              // Update customer_id, application_id, and status in login_data table
              await connection.query(
                  "UPDATE `login` SET customer_id = ?, application_id = ?, status = ? WHERE unique_id = ?",
                  [customer_id, application_id, "5", unique_id]
              );

              connection.release();

              return res.status(200).json({
                  status_code: "21",
                  status: "success",
                  message: "Onboard Agent.",
                  data: {
                      unique_id,
                      name: "",
                      dob: "",
                      gender: "",
                      aadhar_number,
                      residential_address:""
                  }
              });
          }
      }

  } catch (error) {
      console.error(error);
      return res.status(500).json({
          status_code: "2",
          status: "failed",
          message: "Internal Server Error",
      });
  } finally {
      connection.release();
  }
});

router.post("/agent-onboard", requireLogin, async (req, res) => {
  const connection = await poolPromise().getConnection();
  const connection2 = await poolPromise2().getConnection();

  try {
      const {
          // application_id,
          unique_id,
          name,
          email,
          dob,
          gender,
          pan_number,
          aadhar_number,
          residential_address,
          entity_type,
          trade_name,
          legal_name, //
          gst_number,//
          date_of_registration,//
          registration_no,//
          offices_address,
      } = req.body;
     
      // Check if the Agent with the given application id exists
      const [existingAgent] = await connection.query(
          "SELECT * FROM distributor WHERE pan_number = ?",
          [pan_number]
      );
       
      const [loginAgent] = await connection.query(
          "SELECT * FROM login WHERE unique_id = ?",
          [unique_id]
    );
 
 
      if (loginAgent.length === 0) {
          connection.release();
          return res.status(200).json({
              status_code: "2",
              status: "failed",
              message: "Agent with the provided application id does not already exists.",
          });
      }
      // const unique_id = loginAgent[0].unique_id;

      if (existingAgent.length > 0) {
          connection.release();
          return res.status(200).json({
              status_code: "2",
              status: "failed",
              message: "Agent with the Duplicate Pan Number.",
          });
      }
      
      
      // Update Agent data in the Agent table
      await connection.query(
          "INSERT INTO distributor (unique_id, name, email, date_of_birth, pan_number, aadhar_number, residential_address, entity_type, trade_name, legal_name, gst_number, date_of_registration, registration_no, offices_address, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
              unique_id,
              name,
              email,
              dob,
              pan_number,
              aadhar_number,
              JSON.stringify(residential_address),
              entity_type,
              trade_name,
              legal_name,
              gst_number,
              date_of_registration,
              registration_no,
              JSON.stringify(offices_address),
              "KYC-Not Submitted", // Default status
          ]
      );

      // Update wallet data in the wallet table
      await connection2.query(
          "INSERT INTO wallets (user_type, unique_id, wallet, hold, unsettle, createdAt, status) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP(), ?)",
          ["Agent", unique_id, 0.00, 0, 0, "Enable"]
    );
    
    await connection.query("INSERT into stock_data(unique_id,product_value,state) VALUES(?,?,?)",[unique_id,0,"Enable"])

      // Update status in the login_data table
      await connection.query(
          "UPDATE login SET status = ? WHERE unique_id = ?",
          ["4", unique_id]
      );

      connection.release();

      return res.status(200).json({
          status_code: "22",
          status: "success",
          unique_id,
          message: "Update Agent KYC Document ",
      });
  } catch (error) {
      console.error(error);
      return res.status(500).json({
          status_code: "2",
          status: "failed",
          message: "Internal Server Error",
      });
  } finally {
      connection.release();
      connection2.release();
  }
});
router.post("/onboard-agent-kyc", requireLogin, upload3.fields([{
          name: "photo",
          maxCount: 1
      },
      {
          name: "pan_front",
          maxCount: 1
      },
      {
          name: "aadhar_front",
          maxCount: 1
      },
      {
          name: "aadhar_back",
          maxCount: 1
      },
      {
          name: "board_resolution",
          maxCount: 1
      },
      {
          name: "registration_certificate",
          maxCount: 1
      },
  ]),
  async (req, res) => {
      const connection = await poolPromise().getConnection();

      try {
          const {
              unique_id
          } = req.body;

          const [loginAgent] = await connection.query(
              "SELECT * FROM login WHERE unique_id = ?",
              [unique_id]
          );
        

          if (loginAgent.length === 0) {
              connection.release();
              return res.status(200).json({
                  status_code: "2",
                  status: "failed",
                  message: "Agent with the provided application id does not already exists.",
              });
          }
          // const unique_id = loginAgent[0].unique_id;
          const isEmpty = Object.keys(req.files).length === 0;
          console.log(Object.keys(req.files))
          console.log(req.files)
          const mandatory_documents = Object.keys(req.files);
          const includesAll = mandatory_documents.includes('photo') && mandatory_documents.includes('pan_front')  && mandatory_documents.includes('aadhar_front') && mandatory_documents.includes('aadhar_back') 
          if (includesAll === false) {
              connection.release();
              return res.status(422).json({
                  status_code: "2",
                  status: "failed",
                  message: "Please provide required files",
              });
          }
          // Check if the Agent with the given application id exists
          const [existingAgent] = await connection.query(
              "SELECT * FROM distributor WHERE unique_id = ?",
              [unique_id]
          );
            
          if (existingAgent.length === 0) {
              connection.release();
              return res.status(200).json({
                  status_code: "2",
                  status: "failed",
                  message: "Agent with the provided application id does not exist.",
              });
          }
          

          // Upload KYC documents and get file paths
          const photoPath = req.files["photo"] ?
              req.files["photo"][0].filename :
              null;
          const panFrontPath = req.files["pan_front"] ?
              req.files["pan_front"][0].filename :
              null;
          const aadharFrontPath = req.files["aadhar_front"] ?
              req.files["aadhar_front"][0].filename :
              null;
          const aadharBackPath = req.files["aadhar_back"] ?
              req.files["aadhar_back"][0].filename :
              null;
          const boardResolutionPath = req.files["board_resolution"] ?
              req.files["board_resolution"][0].filename :
              null;
          const regCertificatePath = req.files["registration_certificate"] ?
              req.files["registration_certificate"][0].filename :
              null;

          // Update Agent data in the Agent table
          await connection.query(
              "UPDATE distributor SET photo = ?, pan_front = ?, aadhar_front = ?, aadhar_back = ?, board_resolution = ?, reg_certificate = ?, status = ? WHERE unique_id = ?",
              [
                  photoPath,
                  panFrontPath,
                  aadharFrontPath,
                  aadharBackPath,
                  boardResolutionPath,
                  regCertificatePath,
                  "KYC-Pending",
                  unique_id,
              ]
          );

          // Change status code in login_data table from 4 to 3
          await connection.query(
              "UPDATE login SET status = ? WHERE unique_id = ?",
              ["3", unique_id]
          );

          connection.release();

          return res.status(200).json({
              status_code: "23",
              status: "success",
              unique_id,
              message: "Assign Agent Territory",
          });
      } catch (error) {
          console.error(error);
          return res.status(500).json({
              status_code: "2",
              status: "failed",
              message: "Internal Server Error",
          });
      } finally {
          connection.release();
      }
  }
);


router.post("/assign-territory", requireLogin, async (req, res) => {
  const connection = await poolPromise().getConnection();



  //if nahi mila to fetch locaion krke api he usme data fetch krke area table me store krna he
  //if mila to distrcit match krna terrority table se mtch huaa to pincode district status terroritory table me insurt hoga 

  try {
      const {
          unique_id,
          territory
      } = req.body; // territory:"pin"
      const asm_unique_id = req.login.unique_id;
      console.log(asm_unique_id);
      let inserted = false;
      const [usertype] = await connection.query(
          "SELECT user_type FROM territory WHERE unique_id = ?",
          [asm_unique_id]
      );
      if (!(usertype[0].user_type === "001" || usertype[0].user_type === "002"))
      {
          return res.json({
              status_code: "2",
              status: "failed",
              message:"Only ASM or SM can assign territory"
          })
              }
      const [loginAgent] = await connection.query(
          "SELECT * FROM login WHERE unique_id = ? AND status = ?",
          [unique_id, "3"]
      );
     
      if (loginAgent.length === 0) {
          connection.release();
          return res.status(200).json({
              status_code: "2",
              status: "failed",
              message: "Agent with the provided unique id does not already exists or status not match.",
          });
      }
      
      const [AgentData] = await connection.query(
          "SELECT name FROM distributor WHERE unique_id = ?",
          [unique_id]
      );
      if (AgentData.length === 0) {
          connection.release();
          return res.status(200).json({
              status_code: "2",
              status: "failed",
              message: "Agent with the provided unique id does not already exists .",
          });
      }
      // const [alreadyAssigned] = await connection.query(
      //     "SELECT COUNT(*) as count FROM territory WHERE unique_id = ? AND status = ? and user_type = ? ",
      //     [unique_id,"Enable", "Agent"]
      // );

      // if (alreadyAssigned[0].count) {
      
      //     return res.status(200).json({
      //         status_code: "2",
      //         status: "failed",
      //         message: "Territory already assigned to another Agent",
      //     });
      // }
    
      if (typeof (territory) === "object")
      {
          // 
          const present_territories = [];
          for (const pincode of territory) {
              const [exists] = await connection.query('SELECT COUNT(*) AS count FROM territory WHERE pincode = ?', [pincode]);
              if (exists[0].count) {
                  present_territories.push(pincode);
              } 
            }
          if (present_territories.length > 0)
          {
              return res.json({
                  status_code: "2",
                  status: "failed",
                  message:`Agent for pincode ${[present_territories.map(t=> t).join(", ")]} already assigned`
              })
          }

         
          const [areadata] = await connection.query("SELECT * FROM area WHERE pincode IN (?)", [territory]);
          const [ASMteritory] = await connection.query(
              "SELECT district , state FROM territory WHERE unique_id = ? AND status = 'Enable' ",
              [asm_unique_id, "3"]
              );
              if (ASMteritory.length === 0) {
                  return res.status(200).json({
                      status_code: "2",
                      status: "failed",
                      message: "ASM/SM territory not found.",
                  });
              }
          if (areadata.length === 0)
          {

          let pin_data;
          let check_data;
          try
          {
              pin_data = await Promise.all(territory.map(async (t) => await pin_code(Number(t))));
              check_data = pin_data[0][0]
          }
          catch (error)
          {
              return res.status(200).json({
                  status_code: "2",
                  status: "failed",
                  message: "Unable to find pincode",
              })
              }
              // return res.json({DATA:pin_data[0]})
              // const filteredDistrict = pin_data[0].filter(obj => ASMdata.includes(obj.district.toLowerCase()));
              var filteredDistrict = pin_data[0].filter(area => {
                  return ASMteritory.some(item => {
                      return item.district.toLowerCase() == area.district.toLowerCase() && item.state.toLowerCase() == area.state.toLowerCase()
                  })
              })
       
          
          if (filteredDistrict.length > 0)
          {
           
              const keysInOrder = ['pincode', 'area_name', 'district', 'state'];
              var bulkInsertData = filteredDistrict.map(object =>
                  [unique_id, ...keysInOrder.map(key => object[key]), "Agent", "Enable"]
              )
      
              //    return res.json({bulkInsertData})

          } else
          {
              return res.status(200).json({
                  status_code: "2",
                  status: "failed",
                  message: "ASM/SM territory not match with pin code.",
              })
          }
      
          for (const data of bulkInsertData)
          {
              const [unique_id, territory, area_name, district, state, Agent, enable] = data;

              try
              {
                  // Check if the combination already exists
                  const [datav] = await connection.query(`SELECT IF(status = 'Enable', COUNT(*), 0) as count FROM territory WHERE unique_id = ?  AND area = ? AND district = ? AND state = ?`, [unique_id, area_name, district, state]);
                  console.log(datav);
                  let countValue = datav[0].count || 0;
                  if (countValue === 0)
                  {
                      inserted = true;
                      // If the combination does not exist, insert the data
                      const [insertV] = await connection.query(
                          'INSERT INTO territory (unique_id, pincode, area, district, state, user_type, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                          [unique_id, territory, area_name, district, state, Agent, enable]);

                      console.log('Data inserted successfully:', insertV);
                  } else
                  {
                      console.log('Combination already exists');
                  }
              } catch (error)
              {
                  console.error('Error processing data:', error);
              }
          }
          }
          else
          {
              
              
              
              // Getting List of areas that can be assigned by ASM based on 
              var filteredAreas = areadata.filter(area => {
                  return ASMteritory.some(item => {
                      return item.district.toLowerCase() == area.district.toLowerCase() && item.state.toLowerCase() == area.state.toLowerCase()
                  })
              })
              if (filteredAreas.length === 0)
              {
                  return res.status(200).json({
                      status_code: "2",
                      status: "failed",
                      message: "Cannot be assigned to territory",
                  })
                  }
            
              var bulkInsertData = filteredAreas.map(area => {
                  return [
                      unique_id,
                      area.pincode,
                      area.name,
                      area.district,
                      area.state,
                      "Agent",
                      "Enable"
                  ]
              })
            
          for (const data of bulkInsertData)
          {
              const [unique_id, territory, area_name, district, state, Agent, enable] = data;

              try
              {
                  // Check if the combination already exists
                  const [datav] = await connection.query(`SELECT IF(status = 'Enable', COUNT(*), 0) as count FROM territory WHERE area = ? AND district = ? AND state = ?`, [area_name, district, state]);
                  let countValue = datav[0].count || 0;
                  console.log(countValue);
                  if (countValue === 0)
                  {
                      inserted = true;
                      // If the combination does not exist, insert the data
                      const [insertV] = await connection.query(
                          'INSERT INTO territory (unique_id, pincode, area, district, state, user_type, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                          [unique_id, territory, area_name, district, state, Agent, enable]);

                      console.log('Data inserted successfully:', insertV);
                  } else
                  {
                      console.log('Combination already exists');
                  }
              } catch (error)
              {
                  console.error('Error processing data:', error);
              }
          }
          }
          
      }
      else
      {
      
       //area table search 
          const [areadata] = await connection.query("SELECT * FROM area WHERE pincode = ?", [territory])
          const [ASMteritory] = await connection.query(
              "SELECT district , state FROM territory WHERE unique_id = ? AND status = 'Enable' ",
              [asm_unique_id, "3"]
              );
              if (ASMteritory.length === 0) {
                  return res.status(200).json({
                      status_code: "2",
                      status: "failed",
                      message: "ASM/SM territory not found.",
                  });
          }
          const [exists] = await connection.query('SELECT COUNT(*) AS count FROM territory WHERE pincode = ? and status = ?', [territory, "Enable"]);
          if (exists[0].count) {
              return res.status(200).json({
                  status_code: "2",
                  status: "failed",
                  message: "Agent has already been assigned for this territory",
              });
          } 
          // return res.json(areadata)
          if (areadata.length === 0)
          {
              let pin_data;
              let check_data;
              // third party  
              try
              {
                  
              
                  pin_data = await pin_code(Number(territory));
                  check_data = pin_data[0];
              } catch (error)
              {
                  return res.status(200).json({
                      status_code: "2",
                      status: "failed",
                      message: "Unable to find pincode",
                  })
              }
              
          
             
              var filteredDistrict = pin_data.filter(area => {
                  return ASMteritory.some(item => {
                      return item.district.toLowerCase() == area.district.toLowerCase() && item.state.toLowerCase() == area.state.toLowerCase()
                  })
              })
       
              // return res.json({filteredDistrict})
              if (filteredDistrict.length > 0)
              {
                  // console.log(pin_data, "dataaaaaaaaaaa");
                  // Extracting territory data for bulk insert
                  var bulkInsertData = pin_data.map(({
                      area_name,
                      district,
                      state
                  }) => [
                          unique_id,
                          String(territory),
                          area_name,
                          district,
                          state,
                          "Agent",
                          "Enable",
                      ]);
  
              } else
              {
                  return res.status(200).json({
                      status_code: "2",
                      status: "failed",
                      message: "ASM/SM territory not match with pin code.",
                  })
              }
          for (const data of bulkInsertData)
              {
                  const [unique_id, territory, area_name, district, state, Agent, enable] = data;
  
                  try
                  {
                      // Check if the combination already exists
                      const [datav] = await connection.query(`SELECT IF(status = 'Enable', COUNT(*), 0) as count FROM territory WHERE unique_id = ?  AND area = ? AND district = ? AND state = ?`, [unique_id, area_name, district, state]);
                      let countValue = datav[0].count || 0;
                      if (countValue === 0)
                      {
                      inserted = true;

                          // If the combination does not exist, insert the data
                          const [insertV] = await connection.query(
                              'INSERT INTO territory (unique_id, pincode, area, district, state, user_type, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                              [unique_id, territory, area_name, district, state, Agent, enable]);
  
                          console.log('Data inserted successfully:', insertV);
                      } else
                      {
                          console.log('Combination already exists');
                      }
                  } catch (error)
                  {
                      console.error('Error processing data:', error);
                  }
              }
          }
          else
          {
             
              
              
              // Getting List of areas that can be assigned by ASM based on 
              var filteredAreas = areadata.filter(area => {
                  return ASMteritory.some(item => {
                      return item.district.toLowerCase() == area.district.toLowerCase() && item.state.toLowerCase() == area.state.toLowerCase()
                  })
              })
              if (filteredAreas.length === 0)
              {
                  return res.status(200).json({
                      status_code: "2",
                      status: "failed",
                      message: "ASM/SM territory not match with pin code.",
                  })
                  }
              // return res.json({filteredAreas,ASMteritory})
              var bulkInsertData = filteredAreas.map(area => {
                  return [
                      unique_id,
                      area.pincode,
                      area.name,
                      area.district,
                      area.state,
                      "Agent",
                      "Enable"
                  ]
              })
            

          for (const data of bulkInsertData)
          {
              const [unique_id, territory, area_name, district, state, Agent, enable] = data;

              try
              {
                  // Check if the combination already exists
                  const [datav] = await connection.query(`SELECT IF(status = 'Enable', COUNT(*), 0) as count FROM territory WHERE area = ? AND district = ? AND state = ?`, [area_name, district, state]);
                  let countValue = datav[0].count || 0;
                  console.log(countValue);
                  if (countValue === 0)
                  {
                      inserted = true;

                      // If the combination does not exist, insert the data
                      const [insertV] = await connection.query(
                          'INSERT INTO territory (unique_id, pincode, area, district, state, user_type, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                          [unique_id, territory, area_name, district, state, Agent, enable]);

                      console.log('Data inserted successfully:', insertV);
                  } else
                  {
                      console.log('Combination already exists');
                  }
              } catch (error)
              {
                  console.error('Error processing data:', error);
              }
          }
          }
         
      }
     
      //area table search 
      // const [aredata] = await connection.query(
      //     "SELECT * FROM area WHERE pincode = ?",
      //     [territory]
      // );

      // if(aredata.length ==0){
      //     // return res.send('rea not foudn')

      //     const [aredata] = await connection.query(
      //         "SELECT * FROM location  WHERE pincode = ?",
      //         [territory]
      //     );
  
      // }

      
     
      
      
      // const unique_id = loginAgent[0].unique_id;
      if (inserted === false)
      {
          return res.status(200).json({
              status_code: "2",
              status: "failed",
              message: "Agent Not  Registered",
          });
      }
    
      // Change status code in login_data table from 3 to 2
      await connection.query("UPDATE login SET status = ? WHERE unique_id = ?", [
          "2",
          unique_id,
      ]);

      // Send OTP to Agent mobile
      smsapi("admin", "Agent_on-boarded", loginAgent[0].mobile_number, AgentData[0].name);

      connection.release();
      
          
          return res.status(200).json({
              status_code: "1",
              status: "success",
              message: "Agent Successfully Registered",
          });
      
     
      } catch (error) {
      console.error(error);
      return res.status(500).json({
          status_code: "2",
          status: "failed",
          message: "Internal Server Error",
      });
  } finally {
      connection.release();
  }
});













router.post("/dst-search-merchant", requireLogin, async (req, res) => {
  const connection = await poolPromise().getConnection();
  const connection2 = await poolPromise2().getConnection();

  try {
    const { mobile_number, product_id, pin_code, agent_id } = req.body;
    const { customer_id } = req.login;

    // Check if retailer data is available in login_data table
    const [distributorData] = await connection.query(
      "SELECT * FROM login WHERE customer_id = ?",
      [customer_id]
    );
    const [cspData] = await connection2.query(
      "SELECT * FROM login_data WHERE mobile = ?",
      [mobile_number]
    );

    const [fseData] = await connection.query(
      "SELECT * FROM fse WHERE agent_id = ?",
      [agent_id]
    );

    const fse_unique_id = fseData[0].unique_id;

    if (cspData.length > 0) {
      // Retailer data is available, check status
      const statusObject = {
        6: "Mobile Number Verification Pending",
        5: "Onboard Is Pending",
        4: "KYC Onboard Pending",
        3: "Territory Assign is Pending",
        2: "KYC Verification Pending",
        1: "Active",
        0: "Suspended",
      };

      return res.status(200).json({
        status_code: "04",
        status: "success",
        message: statusObject[cspData[0].status],
      });
    }

    //  distributor data not available, check stock
    const [stockData] = await connection.query(
      "SELECT * FROM stock WHERE purchase_id = ? AND unique_id = ?",
      [product_id, distributorData[0].unique_id]
    );

    if (stockData.length === 0) {
      // Stock not available
      connection.release();
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message:
          "This service is currently not available. Contact Distributor Admin.",
      });
    }

    // Stock available, verify pin code
    const [territoryData] = await connection.query(
      'SELECT * FROM territory WHERE unique_id = ? AND pincode = ? AND status = "Enable"',
      [fse_unique_id, pin_code]
    );

    if (territoryData.length === 0) {
      // Pin code not whitelisted
      connection.release();
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message: "FSE not activate in this pin code area.",
      });
    }

    // Pin code is whitelisted, perform activation
    const uniqueId = uuid.v4();
    const customerId = String(customer_id).slice(0,4) + Math.floor(10000 + Math.random() * 90000).toString();
    const applicationId = Date.now().toString() + Math.floor(10 + Math.random() * 90).toString();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Create csp in login_data table
    await connection2.query("INSERT INTO login_data SET ?", {
      user_type: "CSP",
      unique_id: uniqueId,
      application_id: applicationId,
      customer_id: customerId,
      mobile: mobile_number,
      otp: md5(SALT.concat(otp)),
      status: "6", // Default status is 6
    });

    // Create transaction in stock_summary table
    await connection.query("INSERT INTO stock_summary SET ?", {
      order_id: product_id,
      unique_id: uniqueId,
      transaction_type: "Debit",
      transaction_at: new Date(),
      product_id: product_id,
      quantity: 1, // Assuming 1 quantity for the activation
      opening_stock: 0,
      closing_stock: Number(stockData[0].quantity) - 1,
      description: `1 stock Debit for customer_id: ${customerId},application_id:${applicationId}`,
    });

    await connection.query(
      "UPDATE stock SET quantity = quantity - 1 WHERE purchase_id = ? AND unique_id = ?",
      [product_id, distributorData[0].unique_id]
    );

    // Send OTP to user mobile
    const response = await axios.get(
      `https://2factor.in/API/V1/1f985287-a3f0-11ee-8cbb-0200cd936042/SMS/+91${mobile_number}/${otp}/Onboarding+Confirmation`
    );
    console.log(response.data);

    connection.release();

    return res.status(200).json({
      status_code: "03",
      status: "success",
      customer_id: customerId,
      application_id: applicationId,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Internal Server Error",
    });
  } finally {
    connection.release();
  }
});

router.post("/dst-csp-verification", requireLogin, async (req, res) => {
  const connection = await poolPromise2().getConnection();

  try {
    const { application_id, otp } = req.body;
    const { unique_id } = req.login;

    let saltedOTP = SALT.concat(otp);
    var hashedOTP = md5(saltedOTP);

    // Fetch retailer details from the login_data table
    const [retailerResult] = await connection.query(
      'SELECT * FROM login_data WHERE  application_id = ? AND otp = ? AND status = "6"',
      [application_id, hashedOTP]
    );

    if (retailerResult.length === 0) {
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message: "Invalid OTP or Retailer not found",
      });
    }

    // Update status in login_data table from 6 to 5
    await connection.query(
      'UPDATE login_data SET status = "5" WHERE application_id = ?',
      [application_id]
    );

    return res.status(200).json({
      status_code: "01",
      status: "success",
      application_id: application_id,
      message: "Retailer Successfully Verified",
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({
      status_code: "2",
      status: "error",
      message: "Internal Server Error",
    });
  } finally {
    connection.release();
  }
});

router.post("/dst-merchant-onboard", requireLogin, async (req, res) => {
  const connection2 = await poolPromise2().getConnection();

  try {
    const {
      application_id,
      name,
      email,
      date_of_birth,
      pan_number,
      aadhar_number,
      residential_address,
      entity_type,
      shop_name,
      office_address,
      package_id,
    } = req.body;

    // Insert data into login_data and retailer tables
    await connection2.beginTransaction();

    // Check if the user exists with the given unique id
    const [userResult] = await connection2.query(
      "SELECT * FROM login_data WHERE application_id = ? AND status != ?",
      [application_id, "4"]
    );
    if (userResult.length === 0) {
      connection2.release();
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message: "User not found or status is already 4 (KYC Onboard Pending)",
      });
    }

    const user = userResult[0];

    console.log(
      process.env.callEko,
      "callEko vertual",
      typeof process.env.callEko
    );
    if (process.env.callEko !== "false") {
      // Call Third-Party API (Eko Onboard User)
      const ekoOnboardResponse = await savevirtualaccount(
        req,
        res,
        user.unique_id,
        user.trade_name || "no data", // need to change
        pan_number,
        residential_address // need to change
      );
      // Check if Third-Party API response is successful (status 0)
      if (ekoOnboardResponse.status !== 0) {
        connection2.release();
        return res.status(200).json({
          status_code: "2",
          status: "failed",
          message: "CSP onboarding failed with Third-Party API",
        });
      }
    }

    // Insert into login_data table
    await connection2.query(
      "UPDATE login_data SET status = ?, name = ?, package_id = ?, package_status = 'Pending' WHERE id = ?",
      ["4", name, package_id, user.id]
    );

    // Insert into retailer table
    await connection2.query(
      "INSERT INTO retailer (unique_id, email, date_of_birth, pan_number, aadhar_no, residential_address, shop_name, entity_type, office_address, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        user.unique_id,
        email,
        date_of_birth,
        pan_number,
        aadhar_number,
        JSON.stringify(residential_address),
        shop_name,
        entity_type,
        JSON.stringify(office_address),
        "KYC-Not Submitted",
      ]
    );

    const [packageDetailss] = await connection2.query(
      "SELECT * FROM scheme WHERE usertype = ? AND package_id = ?",
      ["CSP", package_id]
    );
    const packageDetails = packageDetailss[0];

    // Insert into schemesummary table
    await connection2.query(
      "INSERT INTO schemesummary (tran_at, order_id, unique_id, customer_id, packid, packname, price, gst, total, status, validity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        new Date(),
        application_id,
        user.unique_id,
        user.customer_id,
        package_id,
        packageDetails.packname,
        packageDetails.price,
        packageDetails.gst,
        packageDetails.total,
        "Pending",
        packageDetails.duration,
      ]
    );

    const [serviceData] = await connection2.execute(
      "SELECT * FROM service_with_package WHERE packages_id = ?",
      [package_id]
    );

    if (!serviceData.length) {
      connection.release();
      return res.status(500).json({
        success: false,
        message: "No services found for this package",
      });
    }

    const userData = serviceData.map((item) => [
      user.customer_id,
      item.packages_id,
      item.services_id,
      item.status,
      item.packages_name,
      item.services_name,
    ]);

    await connection2.query(
      "INSERT INTO users_services (customer_id, packages_id, service_id, status, `packages_name`, `service_name`) VALUES ?",
      [userData]
    );

    // Insert into wallet table
    await connection2.query(
      "INSERT INTO wallet (user_type, unique_id, wallet, hold, unsettle, status) VALUES (?, ?, ?, ?, ?, ?)",
      ["CSP", user.unique_id, 0, 0, 0, "Enable"]
    );

    await connection2.commit();
    connection2.release();

    return res.status(200).json({
      status_code: "05",
      status: "success",
      application_id,
      message: "CSP successfully onboarded. Onboard KYC pending",
    });
  } catch (error) {
    console.error(error);
    await connection2.rollback();
    connection2.release();
    return res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Internal Server Error",
    });
  }
});

router.post("/dst-onboard-merchant-kyc", requireLogin, upload3.fields([
    { name: "photo", maxCount: 1 },
    { name: "pan_front", maxCount: 1 },
    { name: "aadhar_front", maxCount: 1 },
    { name: "aadhar_back", maxCount: 1 },
  ]),
  async (req, res) => {
    const connection = await poolPromise2().getConnection();

    try {
      const { application_id } = req.body;

      // Check if the user exists with the given unique id
      const [userResult] = await connection.query(
        "SELECT * FROM login_data WHERE application_id = ?",
        [application_id]
      );
      if (userResult.length === 0) {
        connection.release();
        return res.status(200).json({
          status_code: "2",
          status: "failed",
          message: "User not found",
        });
      }

      const user = userResult[0];

      const panFrontPath = req.files["pan_front"][0].filename;
      const aadharFrontPath = req.files["aadhar_front"][0].filename;
      const aadharBackPath = req.files["aadhar_back"][0].filename;

      await connection.query(
        "UPDATE retailer SET photo = ?, pan_front = ?, aadhar_front = ?, aadhar_back = ?, status = ? WHERE unique_id = ?",
        [
          panFrontPath,
          panFrontPath,
          aadharFrontPath,
          aadharBackPath,
          "KYC-Submit",
          user.unique_id,
        ]
      );

      // Update status code in login_data table
      await connection.query(
        "UPDATE login_data SET status = ? WHERE application_id = ?",
        ["3", application_id]
      );

      connection.release();

      return res.status(200).json({
        status_code: "06",
        status: "success",
        application_id,
        message: "Activated Merchant/CSP Services",
      });
    } catch (error) {
      console.error(error);
      connection.release();
      return res.status(500).json({
        status_code: "2",
        status: "failed",
        message: "Internal Server Error",
      });
    }
  }
);

router.post("/dst-activated-services", requireLogin, async (req, res) => {
  const connection = await poolPromise2().getConnection();

  try {
    const {
      application_id,
      model_name,
      device_number,
      mode_of_payment,
      agent_id,
    } = req.body;

    const { created_by, customer_id, unique_id } = req.login;

    let distributor_id = unique_id;
    let asm_id = created_by;
    // Check if the user exists with the given unique id
    const [userResult] = await connection.query(
      "SELECT * FROM login_data WHERE application_id = ?",
      [application_id]
    );
    if (userResult.length === 0) {
      connection.release();
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message: "User not found",
      });
    }

    const user = userResult[0];

    // Check if service_id 41 is enabled for the user
    const [userServices] = await connection.query(
      "SELECT * FROM users_services WHERE customer_id = ? AND service_id = 41 AND status = ?",
      [user.customer_id, "Enable"]
    );

    if (userServices.length === 0) {
      // Insert data in mapping table
      await connection.query(
        "INSERT INTO mapping (unique_id, application_id, services_type, created_by ,agent_id, distributor_id, asm_id) VALUES ( ?, ?, ?, ?, ?, ?, ?) ",
        [
          user.unique_id,
          application_id,
          "None",
          agent_id,
          agent_id,
          distributor_id,
          asm_id,
        ]
      );
    } else {
      // Insert data in mapping table
      await connection.query(
        "INSERT INTO mapping (unique_id, application_id, services_type, created_by ,agent_id, distributor_id, asm_id, model_name, device_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ",
        [
          user.unique_id,
          application_id,
          "AePS",
          agent_id,
          agent_id,
          distributor_id,
          asm_id,
          model_name,
          device_number,
        ]
      );
    }

    // Check if model_name and device_number are provided when the service is enabled
    if (userServices.length > 0 && (!model_name || !device_number)) {
      connection.release();
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message: "Model Name and Device Number are missing.",
      });
    }

    // Update status code in login_data table
    await connection.query(
      "UPDATE login_data SET status = ? WHERE application_id = ?",
      ["2", application_id]
    );

    const [scheme] = await connection.query(
      "SELECT * FROM scheme WHERE package_id = ?",
      [user.package_id]
    );

    const currentTimestamp = Date.now();
    const currentDate = new Date(currentTimestamp);
    const expiryDays = scheme[0].duration;
    const expiryTimestamp = currentTimestamp + expiryDays * 24 * 60 * 60 * 1000;
    const expiryDate = new Date(expiryTimestamp);

    const activedate = currentDate.toISOString().substring(0, 10);
    const expiredate = expiryDate.toISOString().substring(0, 10);

    if (mode_of_payment === "Cash" || mode_of_payment === "cash") {
      // Update status, active date, expire date in login_data table
      // (Only if mode of payment is Cash)
      await connection.query(
        "UPDATE login_data SET status = ?, package_activated = ?, package_expiry = ?, package_status = 'Activate' WHERE application_id = ?",
        ["2", activedate, expiredate, application_id]
      );
      // Update status, active date, expire date in scheme summary table
      await connection.query(
        "UPDATE schemesummary SET status = ?, activedate = ?, expiredate = ? WHERE unique_id = ?",
        ["Success", activedate, expiredate, user.unique_id]
      );
    }

    connection.release();

    return res.status(200).json({
      status_code: "1",
      status: "success",
      application_id,
      message: "Retailer is Successfully Created ",
    });
  } catch (error) {
    console.error(error);
    connection.release();
    return res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Internal Server Error",
    });
  }
});

// distributer onboard CSP/REtailer end

// FSE onboard CSP/REtailer start

// In ERP Page Add This Field Sales Executive APIs

router.get("/search-stock", requireFseLogin, async (req, res) => {
  try {
    const { distributor_id } = req.login;

    const connection = await poolPromise().getConnection();

    const [results] = await connection.query(
      "SELECT purchase_id AS Product_id, quantity FROM stock WHERE customer_id  = ?",
      [distributor_id]
    );

    if (results.length === 0) {
      connection.release();
      return res.status(404).json({
        status_code: "2",
        status: "Failed",
        message: "stock not found",
      });
    }

    connection.release();
    return res.status(200).json({
      status_code: "1",
      status: "Success",
      data: results,
    });
  } catch (error) {
    console.error(error.message);
    connection.release();
    return res.status(500).json({
      status_code: "2",
      status: "Failed",
      message: "Internal Server Error",
    });
  }
});

// router.post("/search-merchant", requireFseLogin, async (req, res) => {
//   const connection = await poolPromise().getConnection();
//   const connection2 = await poolPromise2().getConnection();
//   const { distributor_id, unique_id } = req.login;
//   try {
//     const { mobile_number, product_id, pin_code } = req.body;

//     const [distributorData] = await connection.query(
//       "SELECT * FROM login WHERE customer_id = ?",
//       [distributor_id]
//     );
//     const [cspData] = await connection.query(
//       "SELECT * FROM login WHERE mobile_number= ?",
//       [mobile_number]
//     );

//     if (cspData.length > 0) {
//       // Retailer data is available, check status
//       const statusObject = {
//         6: "Mobile Number Verification Pending",
//         5: "Onboard Is Pending",
//         4: "KYC Onboard Pending",
//         3: "Territory Assign is Pending",
//         2: "KYC Verification Pending",
//         1: "Active",
//         0: "Suspended",
//       };

//       return res.status(200).json({
//         status_code: "004",
//         status: "success",
//         message: statusObject[cspData[0].status],
//       });
//     }

//     //  distributor data not available, check stock
//     const [stockData] = await connection.query(
//       "SELECT * FROM stock WHERE purchase_id = ? AND unique_id = ?",
//       [product_id, distributorData[0].unique_id]
//     );

//     if (stockData.length === 0) {
//       // Stock not available
//       connection.release();
//       return res.status(200).json({
//         status_code: "2",
//         status: "failed",
//         message:
//           "This service is currently not available. Contact Distributor Admin.",
//       });
//     }

//     // Stock available, verify pin code
//     const [territoryData] = await connection.query(
//       'SELECT * FROM territory WHERE unique_id = ? AND pincode = ? AND status = "Enable"',
//       [unique_id, pin_code]
//     );

//     if (territoryData.length === 0) {
//       // Pin code not whitelisted
//       connection.release();
//       return res.status(200).json({
//         status_code: "2",
//         status: "failed",
//         message: "FSE not activate in this pin code area.",
//       });
//     }

//     // Pin code is whitelisted, perform activation
//     const uniqueId = uuid.v4();
//     const customerId = Math.floor(10000 + Math.random() * 90000).toString();
//     const applicationId = Date.now().toString();
//     const otp = Math.floor(100000 + Math.random() * 900000).toString();

//     // Create csp in login_data table
//     await connection2.query("INSERT INTO login_data SET ?", {
//       user_type: "CSP",
//       unique_id: uniqueId,
//       application_id: applicationId,
//       customer_id: customerId,
//       mobile: mobile_number,
//       otp: md5(SALT.concat(otp)),
//       status: "6", // Default status is 6
//     });

//     // Create transaction in stock_summary table
//     await connection.query("INSERT INTO stock_summary SET ?", {
//       order_id: product_id,
//       unique_id: uniqueId,
//       transaction_type: "Debit",
//       transaction_at: new Date(),
//       product_id: product_id,
//       quantity: "1", // Assuming 1 quantity for the activation
//       opening_stock: "0",
//       closing_stock: Number(stockData[0].closing_stock) - 1,
//       description: `1 stock Debit for customer_id: ${customerId},application_id:${applicationId}`,
//     });

//     await connection.query(
//       "UPDATE stock SET quantity = quantity - 1 WHERE unique_id = ?",
//       [distributorData[0].unique_id]
//     );

//     // Send OTP to user mobile
//     const response = await axios.get(
//       `https://2factor.in/API/V1/1f985287-a3f0-11ee-8cbb-0200cd936042/SMS/+91${mobile_number}/${otp}/Onboarding+Confirmation`
//     );
//     console.log(response.data);

//     connection.release();

//     return res.status(200).json({
//       status_code: "03",
//       status: "success",
//       customer_id: customerId,
//       application_id: applicationId,
//     });
//   } catch (error) {
//     console.error(error.message);
//     return res.status(500).json({
//       status_code: "2",
//       status: "failed",
//       message: "Internal Server Error",
//     });
//   } finally {
//     connection.release();
//   }
// });

// router.post("/search-merchant", requireFseLogin, async (req, res) => {
//   const connection = await poolPromise().getConnection();
//   const connection2 = await poolPromise2().getConnection();
//   const { distributor_id, unique_id } = req.login;
//   try {
//     const { mobile_number, product_id, pin_code } = req.body;

//     const [distributorData] = await connection.query(
//       "SELECT * FROM login WHERE customer_id = ?",
//       [distributor_id]
//     );
//     const [cspData] = await connection.query(
//       "SELECT * FROM login WHERE mobile_number= ?",
//       [mobile_number]
//     );

//     if (cspData.length > 0) {
//       // Retailer data is available, check status
//       const statusObject = {
//         6: "Mobile Number Verification Pending",
//         5: "Onboard Is Pending",
//         4: "KYC Onboard Pending",
//         3: "Territory Assign is Pending",
//         2: "KYC Verification Pending",
//         1: "Active",
//         0: "Suspended",
//       };

//       return res.status(200).json({
//         status_code: "004",
//         status: "success",
//         message: statusObject[cspData[0].status],
//       });
//     }

//     //  distributor data not available, check stock
//     const [stockData] = await connection.query(
//       "SELECT * FROM stock WHERE purchase_id = ? AND unique_id = ?",
//       [product_id, distributorData[0].unique_id]
//     );

//     if (stockData.length === 0) {
//       // Stock not available
//       connection.release();
//       return res.status(200).json({
//         status_code: "2",
//         status: "failed",
//         message:
//           "This service is currently not available. Contact Distributor Admin.",
//       });
//     }

//     // Stock available, verify pin code
//     const [territoryData] = await connection.query(
//       'SELECT * FROM territory WHERE unique_id = ?, pincode = ? AND status = "Enable"',
//       [unique_id, pin_code]
//     );

//     if (territoryData.length === 0) {
//       // Pin code not whitelisted
//       connection.release();
//       return res.status(200).json({
//         status_code: "2",
//         status: "failed",
//         message: "FSE not activate in this pin code area.",
//       });
//     }

//     // Pin code is whitelisted, perform activation
//     const uniqueId = uuid.v4();
//     const customerId = String(distributor_id).slice(0 ,4) + Math.floor(10000 + Math.random() * 90000).toString();
//     const applicationId = Date.now().toString() + Math.floor(10 + Math.random() * 90).toString();
//     const otp = Math.floor(100000 + Math.random() * 900000).toString();

//     // Create csp in login_data table
//     await connection2.query("INSERT INTO login_data SET ?", {
//       user_type: "CSP",
//       unique_id: uniqueId,
//       application_id: applicationId,
//       customer_id: customerId,
//       mobile: mobile_number,
//       otp: md5(SALT.concat(otp)),
//       status: "6", // Default status is 6
//     });

//     // Create transaction in stock_summary table
//     await connection.query("INSERT INTO stock_summary SET ?", {
//       order_id: product_id,
//       unique_id: uniqueId,
//       transaction_type: "Debit",
//       transaction_at: new Date(),
//       product_id: product_id,
//       quantity: 1, // Assuming 1 quantity for the activation
//       opening_stock: 0,
//       closing_stock: Number(stockData[0].quantity) - 1,
//       description: `1 stock Debit for customer_id: ${customerId},application_id:${applicationId}`,
//     });

//     await connection.query(
//       "UPDATE stock SET quantity = quantity - 1 WHERE purchase_id = ? AND unique_id = ?",
//       [product_id, distributorData[0].unique_id]
//     );

//     // Send OTP to user mobile
//     const response = await axios.get(
//       `https://2factor.in/API/V1/1f985287-a3f0-11ee-8cbb-0200cd936042/SMS/+91${mobile_number}/${otp}/Onboarding+Confirmation`
//     );
//     console.log(response.data);

//     connection.release();

//     return res.status(200).json({
//       status_code: "03",
//       status: "success",
//       customer_id: customerId,
//       application_id: applicationId,
//     });
//   } catch (error) {
//     console.error(error.message);
//     return res.status(500).json({
//       status_code: "2",
//       status: "failed",
//       message: "Internal Server Error",
//     });
//   } finally {
//     connection.release();
//   }
// });

router.post("/csp-verification", requireFseLogin, async (req, res) => {
  const connection = await poolPromise2().getConnection();

  try {
    const { application_id, otp } = req.body;
    const { unique_id } = req.login;
    let saltedOTP = SALT.concat(otp);
    var hashedOTP = md5(saltedOTP);

    // Fetch retailer details from the login_data table
    const [retailerResult] = await connection.query(
      'SELECT * FROM login_data WHERE  application_id = ? AND otp = ? AND status = "7"',
      [application_id, hashedOTP]
    );

    if (retailerResult.length === 0) {
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message: "Invalid OTP or Retailer not found",
      });
    }

    // Update status in login_data table from 6 to 5
    await connection.query(
      'UPDATE login_data SET status = "5" WHERE application_id = ?',
      [application_id]
    );

    return res.status(200).json({
      status_code: "01",
      status: "success",
      application_id: application_id,
      message: "Retailer Successfully Verified",
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Internal Server Error",
    });
  } finally {
    connection.release();
  }
});

router.post("/merchant-onboard", requireFseLogin, async (req, res) => {
  const connection2 = await poolPromise2().getConnection();

  try {
    const {
      application_id,
      name,
      email,
      date_of_birth,
      pan_number,
      aadhar_number,
      residential_address,
      entity_type,
      shop_name,
      office_address,
      package_id,
    } = req.body;

    // Insert data into login_data and retailer tables
    await connection2.beginTransaction();

    // Check if the user exists with the given unique id
    const [userResult] = await connection2.query(
      "SELECT * FROM login_data WHERE application_id = ? AND status != ?",
      [application_id, "4"]
    );
    if (userResult.length === 0) {
      connection2.release();
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message: "User not found or status is already 4 (KYC Onboard Pending)",
      });
    }

    const user = userResult[0];

    console.log(
      process.env.callEko,
      "callEko vertual",
      typeof process.env.callEko
    );
    if (process.env.callEko !== "false") {
      // Call Third-Party API (Eko Onboard User)
      const ekoOnboardResponse = await savevirtualaccount(
        req,
        res,
        user.unique_id,
        user.trade_name || "no data", // need to change
        pan_number,
        residential_address // need to change
      );
      // Check if Third-Party API response is successful (status 0)
      if (ekoOnboardResponse.status !== 0) {
        connection2.release();
        return res.status(200).json({
          status_code: "2",
          status: "failed",
          message: "CSP onboarding failed with Third-Party API",
        });
      }
    }

    // Insert into login_data table
    await connection2.query(
      "UPDATE login_data SET status = ?, name = ?, package_id = ?, package_status = 'Pending' WHERE id = ?",
      ["4", name, package_id, user.id]
    );

    // Insert into retailer table
    await connection2.query(
      "INSERT INTO retailer (unique_id, email, date_of_birth, pan_number, aadhar_no, residential_address, shop_name, entity_type, office_address, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        user.unique_id,
        email,
        date_of_birth,
        pan_number,
        aadhar_number,
        JSON.stringify(residential_address),
        shop_name,
        entity_type,
        JSON.stringify(office_address),
        "KYC-Not Submitted",
      ]
    );

    const [packageDetailss] = await connection2.query(
      "SELECT * FROM scheme WHERE usertype = ? AND package_id = ?",
      ["CSP", package_id]
    );
    const packageDetails = packageDetailss[0];

    // Insert into schemesummary table
    await connection2.query(
      "INSERT INTO schemesummary (tran_at, order_id, unique_id, customer_id, packid, packname, price, gst, total, status, validity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        new Date(),
        application_id,
        user.unique_id,
        user.customer_id,
        package_id,
        packageDetails.packname,
        packageDetails.price,
        packageDetails.gst,
        packageDetails.total,
        "Pending",
        packageDetails.duration,
      ]
    );

    const [serviceData] = await connection2.execute(
      "SELECT * FROM service_with_package WHERE packages_id = ?",
      [package_id]
    );

    if (!serviceData.length) {
      connection.release();
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
      item.packname,
      item.services_name,
    ]);

    await connection2.query(
      "INSERT INTO users_services (customer_id, packages_id, service_id, status, `packages_name`, `service_name`) VALUES ?",
      [userData]
    );

    // Insert into wallet table
    await connection2.query(
      "INSERT INTO wallet (user_type, unique_id, wallet, hold, unsettle, status) VALUES (?, ?, ?, ?, ?, ?)",
      ["CSP", user.unique_id, 0, 0, 0, "Enable"]
    );

    await connection2.commit();
    connection2.release();

    return res.status(200).json({
      status_code: "05",
      status: "success",
      application_id,
      message: "CSP successfully onboarded. Onboard KYC pending",
    });
  } catch (error) {
    console.error(error);
    await connection2.rollback();
    connection2.release();
    return res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Internal Server Error",
    });
  }
});

// provide merchant userdocs path in storage3
router.post("/onboard-merchant-kyc",
  requireFseLogin,
  upload3.fields([
    { name: "photo", maxCount: 1 },
    { name: "pan_front", maxCount: 1 },
    { name: "aadhar_front", maxCount: 1 },
    { name: "aadhar_back", maxCount: 1 },
  ]),
  async (req, res) => {
    const connection = await poolPromise2().getConnection();

    try {
      const { application_id } = req.body;

      // Check if the user exists with the given unique id
      const [userResult] = await connection.query(
        "SELECT * FROM login_data WHERE application_id = ?",
        [application_id]
      );
      if (userResult.length === 0) {
        connection.release();
        return res.status(200).json({
          status_code: "2",
          status: "failed",
          message: "User not found",
        });
      }

      const user = userResult[0];

      const panFrontPath = req.files["pan_front"][0].filename;
      const aadharFrontPath = req.files["aadhar_front"][0].filename;
      const aadharBackPath = req.files["aadhar_back"][0].filename;

      await connection.query(
        "UPDATE retailer SET photo = ?, pan_front = ?, aadhar_front = ?, aadhar_back = ?, status = ? WHERE unique_id = ?",
        [
          panFrontPath,
          panFrontPath,
          aadharFrontPath,
          aadharBackPath,
          "KYC-Submit",
          user.unique_id,
        ]
      );

      // Update status code in login_data table
      await connection.query(
        "UPDATE login_data SET status = ? WHERE application_id = ?",
        ["3", application_id]
      );

      connection.release();

      return res.status(200).json({
        status_code: "06",
        status: "success",
        application_id,
        message: "Activated Merchant/CSP Services",
      });
    } catch (error) {
      console.error(error);
      connection.release();
      return res.status(500).json({
        status_code: "2",
        status: "failed",
        message: "Internal Server Error",
      });
    }
  }
);

// fse data table pendind for ids in mapping
router.post("/activated-services", requireFseLogin, async (req, res) => {
  const connection = await poolPromise2().getConnection();

  try {
    const { application_id, model_name, device_number, mode_of_payment } =
      req.body;
    const { unique_id, agent_id, distributor_id, asm_id } = req.login;
    // Check if the user exists with the given unique id
    const [userResult] = await connection.query(
      "SELECT * FROM login_data WHERE application_id = ?",
      [application_id]
    );
    if (userResult.length === 0) {
      connection.release();
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message: "User not found",
      });
    }

    const user = userResult[0];

    // Check if service_id 41 is enabled for the user
    const [userServices] = await connection.query(
      "SELECT * FROM users_services WHERE customer_id = ? AND service_id = 41 AND status = ?",
      [user.customer_id, "Enable"]
    );

    if (userServices.length === 0) {
      // Insert data in mapping table
      await connection.query(
        "INSERT INTO mapping (unique_id, application_id, services_type, created_by ,agent_id, distributor_id, asm_id) VALUES ( ?, ?, ?, ?, ?, ?, ?) ",
        [
          user.unique_id,
          application_id,
          "None",
          agent_id,
          agent_id,
          unique_id,
          asm_id,
        ]
      );
    } else {
      // Insert data in mapping table
      await connection.query(
        "INSERT INTO mapping (unique_id, application_id, services_type, created_by ,agent_id, distributor_id, asm_id, model_name, device_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ",
        [
          user.unique_id,
          application_id,
          "AePS",
          agent_id,
          agent_id,
          unique_id,
          asm_id,
          model_name,
          device_number,
        ]
      );
    }

    // Check if model_name and device_number are provided when the service is enabled
    if (userServices.length > 0 && (!model_name || !device_number)) {
      connection.release();
      return res.status(200).json({
        status_code: "2",
        status: "failed",
        message: "Model Name and Device Number are missing.",
      });
    }

    // Update status code in login_data table
    await connection.query(
      "UPDATE login_data SET status = ? WHERE application_id = ?",
      ["2", application_id]
    );

    const [scheme] = await connection.query(
      "SELECT * FROM scheme WHERE package_id = ?",
      [user.package_id]
    );

    const currentTimestamp = Date.now();
    const currentDate = new Date(currentTimestamp);
    const expiryDays = scheme[0].duration;
    const expiryTimestamp = currentTimestamp + expiryDays * 24 * 60 * 60 * 1000;
    const expiryDate = new Date(expiryTimestamp);

    const activedate = currentDate.toISOString().substring(0, 10);
    const expiredate = expiryDate.toISOString().substring(0, 10);

    if (mode_of_payment === "Cash" || mode_of_payment === "cash") {
      // Update status, active date, expire date in login_data table
      // (Only if mode of payment is Cash)
      await connection.query(
        "UPDATE login_data SET status = ?, package_activated = ?, package_expiry = ?, package_status = 'Activate' WHERE application_id = ?",
        ["2", activedate, expiredate, application_id]
      );
      // Update status, active date, expire date in scheme summary table
      await connection.query(
        "UPDATE schemesummary SET status = ?, activedate = ?, expiredate = ? WHERE unique_id = ?",
        ["Success", activedate, expiredate, user.unique_id]
      );
    }

    connection.release();

    return res.status(200).json({
      status_code: "1",
      status: "success",
      application_id,
      message: "Retailer is Successfully Created ",
    });
  } catch (error) {
    console.error(error);
    connection.release();
    return res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Internal Server Error",
    });
  }
});

//FSE onboard CSP/REtailer end

module.exports = router;
