const axios = require('axios');
const qs = require('qs');
const NodeRSA = require('node-jsencrypt');
const { getSecretKeyAndTimeStamp } = require('./getSecretKey');



async function getAadharOtp(aadhar_number,user_code) {
  const { secretKey, Timestamp } = getSecretKeyAndTimeStamp();

  let data = qs.stringify({
    'initiator_id': '9830299198',
    'customer_id': '9831693333',
  //  'aadhar': 'jtJnzxgNvajGLOLLS2LSVPItchsgYWcQrGlCX+j78ODfKu7lSXNrfVHt+NYirc5laAaKJBxdKWLZ21w7zOnhhv3PNvdxt3QXMKiWDquEnl96gHQMcR8iqGf8FBCOlcC8VFpn/Jg28+PM92EBprY+kmOF/T37ep5oGTUl7xhAjuo=',
   'aadhar': generateAadharRSA(aadhar_number),
    'user_code': user_code,
    'latlong': '123.0000,234.002344' 
  });

  let config = {
    method: 'get',
    maxBodyLength: Infinity,
    url: 'https://api.eko.in:25002/ekoicici/v1/aeps/otp',
    headers: { 
      'developer_key': '0d13fefbdd3d507c3a1485e6694d4197', 
      'secret-key': secretKey, 
      'secret-key-timestamp': Timestamp, 
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    data : data
  };
  // return config
  try {
    const response = await axios.request(config);
    return {data: response.data,config:config};
  } catch (error) {
    console.log(error);
    throw error; // rethrow the error to handle it outside of this function
  }
}

function generateAadharRSA(aadhar_number)
{
const rsa = new NodeRSA();
// const publicKey = 'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCaFyrzeDhMaFLx+LZUNOOO14Pj9aPfr+1WOanDgDHxo9NekENYcWUftM9Y17ul2pXr3bqw0GCh4uxNoTQ5cTH4buI42LI8ibMaf7Kppq9MzdzI9/7pOffgdSn+P8J64CJAk3VrVswVgfy8lABt7fL8R6XReI9x8ewwKHhCRTwBgQIDAQAB';
  const publicKey = process.env.e_kyc_public_key;
rsa.setPublicKey(publicKey);

const plaintext = aadhar_number;
const encrypted = rsa.encrypt(plaintext, 'base64');

return encrypted
}

async function verifyAadharOtp(otp, otp_ref_id, reference_tid,aadhar_number,user_code)
{
  const { secretKey, Timestamp } = getSecretKeyAndTimeStamp();
  console.log(`otp_ref_id  ${otp_ref_id}`)
  console.log(`reference_Tid  ${reference_tid}`)

  let data = qs.stringify({
    'initiator_id': '9830299198',
    'customer_id': '9831693333',
    //'aadhar': 'jtJnzxgNvajGLOLLS2LSVPItchsgYWcQrGlCX+j78ODfKu7lSXNrfVHt+NYirc5laAaKJBxdKWLZ21w7zOnhhv3PNvdxt3QXMKiWDquEnl96gHQMcR8iqGf8FBCOlcC8VFpn/Jg28+PM92EBprY+kmOF/T37ep5oGTUl7xhAjuo=',
    'aadhar': generateAadharRSA(aadhar_number),
    'user_code': user_code,
    'otp': otp,
    'otp_ref_id': otp_ref_id,
    'reference_tid': reference_tid,
    'latlong': '123.0000,234.002344' 
  });
  
  let config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: 'https://api.eko.in:25002/ekoicici/v1/aeps/otp/verify',
    headers: { 
      'developer_key': '0d13fefbdd3d507c3a1485e6694d4197', 
      'secret-key': secretKey, 
      'secret-key-timestamp': Timestamp, 
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    data : data
  };
  // return config
  try {
    const response = await axios.request(config);
    console.log(response)
    return {data: response.data,config:config};
  } catch (error) {
    console.log(error);
    throw error; // rethrow the error to handle it outside of this function
  }
  
}
module.exports = {getAadharOtp,verifyAadharOtp}