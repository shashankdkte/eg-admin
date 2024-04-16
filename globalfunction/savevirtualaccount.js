const poolPromise = require("../util/connnectionPromise2");
const poolPromise3 = require("../util/connectionPromise3");
const axios = require("axios");

const savevirtualaccount = async (
  req,
  res,
  unique_id,
  trade_name,
  pan_number,
  address,
  ...others
) => {
  var unique_id = unique_id;
  let [ email, customer_id, application_id ] = others
  const connection = await poolPromise().getConnection();

  try {
    const [users] = await connection.query(
      "SELECT * FROM auths WHERE unique_id = ?",
      [unique_id]
    );
    console.log("*********************");
    console.log(users)
    

    const mobile = users[0].mobile;
    const email_id = email;
    const bank_codes = ["UTIB"]
    // const [bank_codes] = await connection.query(
    //   "SELECT * FROM virtualac_bankcode WHERE status = ?",
    //   "Enable"
    // );
    var request = {
      abc: "a",
    };
    var response = {
      abc: "a",
    };
    var insertId;
    
    
      const [virtual_account] = await connection.query(
        "INSERT INTO virtual_account (name,unique_id, bank, transaction_limit, minimum_balance, status, request, response) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          trade_name,
          unique_id,
          bank_codes[0],
          "100000.0",
          "0",
          "Pending",
          JSON.stringify(request),
          JSON.stringify(response),
        ]
      );
      insertId = virtual_account.insertId;
    ;
    
    const prover_name = "decentro";
    // const [headers_key] = await connection.execute(
    //   "SELECT * FROM vender_key WHERE prover_name = ?",
    //   [prover_name]
    // );
    const apiurl = `${process.env.virtual_account_url}/v2/banking/account/virtual`;
    const headers = {
      client_id: process.env.virtual_account_client_id,
      client_secret: process.env.virtual_account_client_secret,
      module_secret: process.env.virtual_account_module_secret,
      // provider_secret: headers_key[0].value_4,
      "Content-Type": "application/json",
    };
   
    let bank_codes_arr;
    // bank_codes_arr = bank_codes.map((item) => item.bank_code);
    bank_codes_arr = bank_codes
    var addresss =
      address.area +
      " " +
      address.pincode +
      " " +
      address.district +
      " " +
      address.state;

    const requestBody = {
      bank_codes: bank_codes_arr,
      name: trade_name,
      pan: pan_number,
      email: email_id,
      // mobile: "7009990099",
      mobile: String(mobile),
      address: String(addresss),
      kyc_verified: 1,
      kyc_check_decentro: 0,
      minimum_balance: 0,
      transaction_limit: 1000000.0,
      // customer_id: "231017DEC0001",
      customer_id: String(customer_id),
      virtual_account_balance_settlement: "enabled",
      upi_onboarding: false,
    };
    try
    {
      try {
        
        const data = await axios.post(apiurl, requestBody, { headers });
      }
      catch (error)
      {
        console.log(error.response.data)
        return error;
        
      }

      var response = data.data;
     
      var requestSuccess = {
        headers,
        apiurl: apiurl,
        requestBody: requestBody,
      };

      var upi = "False";
      var imps = "False";
      var neft = "False";
      var rtgs = "False";

      var arrData = [];
      const check = response?.data?.map((data, i) => data.allowedMethods);
      check[0].map((data) => {
        if (data === "IMPS") {
          imps = "True";
        } else if (data === "NEFT") {
          neft = "True";
        } else if (data === "RTGS") {
          rtgs = "True";
        } else if (data === "UPI") {
          upi = "True";
        }
      });

      const values = response?.data?.map((data) => [
        data.bank,
        data.accountNumber,
        data.ifsc,
        upi,
        imps,
        neft,
        rtgs,
        (data.status = "SUCCESS"),
        JSON.stringify(requestSuccess),
        JSON.stringify(response),
        insertId,
      ]);
      console.log(values);
     
        const [virtual_account] = await connection.query(
          "UPDATE virtual_account SET bank = ?, accountnumber = ?, ifsc = ?, upi = ?, imps = ?, neft = ?, rtgs = ?, status = ?, request = ?, response = ? WHERE id = ?",
          values[0]
        );
        // console.log("Response Success", virtual_account);
       

       
          return {status_code:"01", status:"success",values:values[0]}
        
      ;
    } catch (error) {
      var requestErr = {
        headers,
        apiurl: apiurl,
        requestBody: requestBody,
      };
      const [virtual_account] = await connection.query(
        "UPDATE virtual_account SET status = ?, request = ?, response = ? WHERE id = ?",
        [
          "FAIELD",
          JSON.stringify(requestErr),
          JSON.stringify(error.response?.data),
          insertId,
        ]
      );
      // console.log(virtual_account, "virtual_account FAIELD");
      {
        return {
          status_code: "02",
          status: "Fail",
          message: error.response?.data?.message,
        };
      }
    }
  } finally {
    if (connection) {
      await connection.release();
    }
  }
};



const savevirtualaccount_user = async (
  req,
  res,
  unique_id,
  trade_name,
  pan_number,
  address,
  test
) => {
  var unique_id = unique_id;

  const connection3 = await poolPromise3().getConnection();

  try{
    const [users] = await connection3.query(
      "SELECT * FROM users WHERE unique_id = ?",
      [unique_id]
    );
    const mobile = users[0].mobile;
    const email_id = users[0].email_id;
    const customer_id = users[0].customer_id;
  
    const [bank_codes] = await connection3.query(
      "SELECT * FROM virtualac_bankcode WHERE status = ?",
      "Enable"
    );
    var request = {
      abc: "a",
    };
    var response = {
      abc: "a",
    };
    var insertId;
    bank_codes.map(async (item) => {
      const [virtual_account] = await connection3.query(
        "INSERT INTO virtual_account (name,unique_id, bank, transaction_limit, minimum_balance, status, request, response) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          trade_name,
          unique_id,
          item.bank_name,
          "100000.0",
          "0",
          "Pending",
          JSON.stringify(request),
          JSON.stringify(response),
        ]
      );
      insertId = virtual_account.insertId;
    });
  
    const prover_name = "decentro";
    const [headers_key] = await connection3.execute(
      "SELECT * FROM vender_key WHERE prover_name = ?",
      [prover_name]
    );
    const apiurl = `${headers_key[0].bash_url}/v2/banking/account/virtual`;
    const headers = {
      client_id: headers_key[0].value,
      client_secret: headers_key[0].value_1,
      module_secret: headers_key[0].value_2,
      // provider_secret: headers_key[0].value_4,
      "Content-Type": "application/json",
    };
    let bank_codes_arr;
    bank_codes_arr = bank_codes.map((item) => item.bank_code);
  
    var addresss =
      address.area +
      " " +
      address.pincode +
      " " +
      address.district +
      " " +
      address.state;
  
    const requestBody = {
      bank_codes: bank_codes_arr,
      name: trade_name,
      pan: pan_number,
      email: email_id,
      mobile: String(mobile),
      address: String(addresss),
      kyc_verified: 1,
      kyc_check_decentro: 0,
      minimum_balance: 0,
      transaction_limit: 1000000.0,
      customer_id: String(customer_id),
      virtual_account_balance_settlement: "enabled",
      master_account_alias:"decentro_account_idfc_2",
      upi_onboarding: false,
    };
  
    try {
      const data = await axios.post(apiurl, requestBody, { headers });
      var response = data.data;
      var requestSuccess = {
        headers,
        apiurl: apiurl,
        requestBody: requestBody,
      };
  
      var upi = "False";
      var imps = "False";
      var neft = "False";
      var rtgs = "False";
  
      var arrData = [];
      const check = response?.data?.map((data, i) => data.allowedMethods);
      check[0].map((data) => {
        if (data === "IMPS") {
          imps = "True";
        } else if (data === "NEFT") {
          neft = "True";
        } else if (data === "RTGS") {
          rtgs = "True";
        } else if (data === "UPI") {
          upi = "True";
        }
      });
  
      const values = response?.data?.map((data) => [
        data.bank,
        data.accountNumber,
        data.ifsc,
        upi,
        imps,
        neft,
        rtgs,
        (data.status = "SUCCESS"),
        JSON.stringify(requestSuccess),
        JSON.stringify(response),
        insertId,
      ]);
      // console.log(values);
      values?.map(async (value) => {
        const [virtual_account] = await connection3.query(
          "UPDATE virtual_account SET bank = ?, accountnumber = ?, ifsc = ?, upi = ?, imps = ?, neft = ?, rtgs = ?, status = ?, request = ?, response = ? WHERE id = ?",
          value
        );
        // console.log("Response Success", virtual_account);
  
        if (test) {
          return {
            statuscode: "01",
            status: "Success",
            values,
          };
        }
      });
    } catch (error) {
      var requestErr = {
        headers,
        apiurl: apiurl,
        requestBody: requestBody,
      };
      const [virtual_account] = await connection3.query(
        "UPDATE virtual_account SET status = ?, request = ?, response = ? WHERE id = ?",
        [
          "FAIELD",
          JSON.stringify(requestErr),
          JSON.stringify(error.response.data),
          insertId,
        ]
      );
      // console.log(virtual_account, "virtual_account FAIELD");
      if (test) {
        return res.status(200).json({
          statuscode: "02",
          status: "Fail",
          message: error.response.data.message,
        });
      }
    }
  }finally {
    if (connection3) {
      await connection3.release();
    }
  }

 
};

module.exports = { savevirtualaccount , savevirtualaccount_user };
