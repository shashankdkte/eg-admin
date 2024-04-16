const poolPromise = require("../util/connnectionPromise");
const moment = require('moment-timezone');
const fetch = require('node-fetch');

const sentOtp = async (var1, var2, templatecode, mobile) => {
  try
  {
    
    const connection = await poolPromise().getConnection();

    const templateQuery =
      "SELECT templates, templateid FROM sms_template WHERE sms_template.id = ? AND sms_template.status = ?";
    const templateValues = [templatecode, "1"];
    const smstemplate = await connection.query(templateQuery, templateValues);
   

    const templates = smstemplate[0][0].templates;
    const templateId = smstemplate[0][0].templateid;
  
    const message = templates.replace("VAR1", var1).replace("VAR2", var2);

    const smsGatewayQuery =
      "SELECT * FROM sms_gateway WHERE sms_gateway.status = ?";
    const smsGatewayValues = [1];
    const smsapicode = await connection.query(
      smsGatewayQuery,
      smsGatewayValues
    );

    const api_url = smsapicode[0][0].api;
    const api_userid = smsapicode[0][0].user_id;
    const api_password = smsapicode[0][0].password;
    const api_sender = smsapicode[0][0].sender_id;
    const gateway_id = smsapicode[0][0].id;

    const finalurl = api_url
      .replace("USERID", api_userid)
      .replace("PASSWORD", api_password)
      .replace("SENDERID", api_sender)
      .replace("MOBILE", mobile)
      .replace("MESSAGE", message)
      .replace("TEMPLATE", templateId)
      .replace(/\s/g, "%20");

    const date = moment().tz("Asia/Calcutta").format("DD-MM-YYYY");
    const newdate = date;

    const settings = { method: "GET"  };
    let result = null
    if (gateway_id === 1)
    {
      result = await fetch(finalurl, settings).then((res) => res.text()).catch((err)=> console.log(err));
    }
    else
    { 
      result = await fetch(finalurl, settings).then((res) => res.json()).catch(err => console.log(err));
      
    }
   
    
  
    const errorCode = result["ErrorCode"];
  

    const smsHistoryQuery =
      "INSERT INTO smshistory (message, mobile, errorcode, templateid, date) VALUES (?, ?, ?, ?, ?)";
    const smsHistoryValues = [message, mobile, errorCode, templateId, newdate];
    await connection.query(smsHistoryQuery, smsHistoryValues);
    console.log(smsHistoryQuery);
    connection.release();

    return "OTP Sent successfully";
  } catch (err) {
    throw err;
  }
};


module.exports = sentOtp;