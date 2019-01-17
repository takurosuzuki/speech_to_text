// 2018/11/18 21:18 promiseを有効化
// 2018/11/18 22:36 DynamoDBを有効化
// 2018/11/18 23:20 Dynamoテーブルを環境変数から取る
// 2018/11/18 23:39 FileCopyとffmpegのキック
// 2018/11/19 0:07  Watsonの呼び出し有効化
// 2018/11/19 10:51 Chatwork有効化
// 2018/11/19 11:23 Chatworkコードのoptionは更新エラーになるのでoption2に変更
// 2018/11/19 12:20 option2のルームID変更、json削除
// 2018/11/19 16:47 SFDC APIの呼び出し方を整理
// 2018/11/19 17:32 SFDC JSONの記述方法を修正

const speech = require('@google-cloud/speech');
const aws = require('aws-sdk');
const s3 = new aws.S3();
const rp = require('request-promise');
const fs = require('fs');
const language = require('@google-cloud/language');
var FormData = require('form-data');

console.log('Loaded: AICC-2031590-s3wav-Func');


exports.handler = async (event, context) => {
    console.log('Called: handler');

    
    if(event.Records && event.Records[0] && event.Records[0].s3.bucket){
        await put_s3(event); // S3にWAVファイルがアップされた時の処理
    } else if (event.Details && event.Details.Parameters) {
        await connect_func(event); // 着信時の処理
    }
    //return {};
    
    return {"outputData": "handler"};

};

// 着信時の処理 
async function connect_func(event) {
    console.log('Called: connect_func');
    console.log(JSON.stringify(event));
    
    const phoneNumber = event.Details.ContactData.CustomerEndpoint.Address;
    await savePhoneNumber(phoneNumber);
    

    return {"outputData": "connect_func"};
}

const region = 'ap-northeast-1';
const tableName = process.env['TABLE_NAME'];
const value = '001';
 
// 電話番号の保存
async function savePhoneNumber(phoneNumber) {
    console.log('Called: savePhoneNumber');
    console.log('TABEL_NAME: ' + tableName);
    
    const client = new aws.DynamoDB.DocumentClient({region: region});
    const item = {
         'id': value,
         "phoneNumber": phoneNumber
    }
    const result = await client.put( {
                "TableName": tableName,
                "Item": item
              }).promise();
    console.log(result);
    
    
    return {"outputData": "savePhoneNumber"};

}
 
// 電話番号の読み込み
async function readPhoneNumber() {
    console.log('Called: readPhoneNumber');

    
    const client = new aws.DynamoDB.DocumentClient({region: region});
    const param = {
        TableName : tableName,
        KeyConditionExpression : "#k = :val",
        ExpressionAttributeValues : {":val" : value},
        ExpressionAttributeNames  : {"#k" : 'id'}
    };
    const result = await client.query(param).promise();
    if(result && result.Items && result.Items.length > 0){
        return result.Items[0].phoneNumber;
    }
    return 'NotFound';
}
 
// S3にWAVファイルがアップされた時の処理
async function put_s3(event){
    console.log('Called: put_s3');
    
    
    //******************************************************* */
    // putされたファイルを/tmpにダウンロードする
    //******************************************************* */
    
    const bucket = event.Records[0].s3.bucket.name;
    const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
    const params = {
        Bucket: bucket,
        Key: key,
    };
	console.log("key:" + key);
    const srcPath= '/tmp/src.wav';
    const obj = await s3.getObject(params).promise();
    fs.writeFileSync(srcPath, obj.Body);
    
    
    //******************************************************* */
    // ffmpegでサンプリングレートの変更
    //******************************************************* */
    
    const dstPath = '/tmp/dst.wav';
    const cmdline = "./ffmpeg -y -i " + srcPath + " -ar 16000 -ac 1 " + dstPath;
    const execSync = require('child_process').execSync;
    const result =  execSync(cmdline);
    console.log("ffmpeg result:" + result);
    
    var result2 = "" + execSync('ls -lah /var/task/');
    console.log("ls result2:" + result2);

    var result3 = "" + execSync('ls -lah /tmp/');
    console.log("ls result3:" + result3);
    
    //******************************************************* */
    // Google Speech to Text でテキストへの変換
    //******************************************************* */
	/*	
	const data = fs.readFileSync(dstPath);
	const audioBytes = data.toString('base64');

	console.log("dataString_log");
	console.log("dataString_log_after");
    const options = {
        method: 'POST',
        url: 'https://speech.googleapis.com/v1/speech:recognize?key=AIzaSyDPt55SuEy7TLIWJhiALb4lFTw-gUHHIiw',
        headers : {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
				"config" :{
					"encoding":"linear16",
					"sampleRateHertz": 16000,
					"languageCode":"ja-JP"
			  },"audio":{
					"content": audioBytes
			  }
			})
    };

	console.log("request_before");
    const response = await rp(options);
	console.log("request_after");
    const json = JSON.parse(response);
    let message = '';
    json.results.forEach(result => {
        result.alternatives.forEach( alternative =>{
            if(alternative.transcript){
                message += alternative.transcript;
            }
        })
    });
    
	//ログ確認
	console.log("message:" + message);
	*/

	//---------------------------------------------------------------------


	//COTOHA版Speech to Text------------------------------------------------
	const model = 'ja-gen_tf-16';

	const client_id_speech = 'QdcAzqnq02908zXacGVbOuLWzh5BIboM'; //適切なclient_idを指定
	const client_secret_speech = 'MGMUMYShhiB6UWct'; //適切なclient_secretを指定
	const domain_id = "q78b51r6"; //適切なdomain_idを指定

	const url = "cotoha-api-dev-prod.apigee.net";
	const path = "/api/dev/asr/v1/speech_recognition/" + model;
	const rate = 16000;

	var body = '';
	let message = '';
	var CRLF = '\r\n';
	var form_speech = new FormData();
	const boundary = form_speech.getBoundary();

	var str = fs.readFileSync(dstPath).toString("hex");

	const options8 = {
                method: "POST",
                url:"https://cotoha-api-dev-prod.apigee.net/v1/oauth/accesstokens",
                headers: {
                                "charset":"UTF-8",
                                "Content-Type":"application/json"
                },
                body: JSON.stringify({
                                "grantType": "client_credentials",
                                "clientId": client_id_speech,
                                "clientSecret": client_secret_speech
                })
	};

	const response_access_token_speech = await rp(options8);
	var json8 = JSON.parse(response_access_token_speech);
	const access_token_speech = json8.access_token;
	console.log("access_token:" + access_token_speech);
	const Authoriz_speech = "Bearer "+ access_token_speech;

	const start_json = {
        "msg": {
                "msgname": "start"
        },
        "param": {
                "baseParam.samplingRate": rate,
                "recognizeParameter.domainId": domain_id,
                "recognizeParameter.enableContinuous": 'true'
        }
	}
	
	const stop_json = {
        "msg": {
                "msgname": "stop"
        },
	}
	
	var parameter_options = {
  		header: '--' + boundary + CRLF + 'Content-Disposition: form-data; name=\"parameter\"' + CRLF + 'Content-Type: application/json' + CRLF+ CRLF, 
	};
	
	var audio_options = {
  		header: '--' + boundary + CRLF + 'Content-Disposition: form-data; name=\"audio\"' + CRLF + 'Content-Type: application/octet-stream' + CRLF+ CRLF,
	};

	var command_options = {
		header: '--' + boundary + CRLF + 'Content-Disposition: form-data; name=\"command\"' + CRLF + 'Content-Type: application/json' + CRLF + CRLF,
	};
	
	form_speech.append('parameter', JSON.stringify(start_json), parameter_options);
	form_speech.append('audio', str, audio_options);
	form_speech.append('command', JSON.stringify(stop_json), command_options);
	
	form_speech.submit({
		host: url,
  		path: path,
  		headers: {
  			'Authorization': Authoriz_speech,
		}
	},
	async function(err, res) {
		if (err) throw err;
		res.on("data", async function(chunk) {
    		//console.log("BODY: " + chunk);
			body += chunk;
  		});
		res.on("end", async function(res){
			res = JSON.parse(body);
			for(var i=0; i<res.length; i++){
					console.log(res[i]);
					try{
							message += res[i].result.sentence[0]['surface'];
					}
					catch(error){};
			}
			//ログ確認
			console.log("message:" + message);
				//Google感情分析API------------------------------------------
				const options4 = {
					method: 'POST',
					uri: 'https://language.googleapis.com/v1beta1/documents:analyzeSentiment?key=AIzaSyDPt55SuEy7TLIWJhiALb4lFTw-gUHHIiw',
					headers : {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
								"document" :{ 
									"type":"PLAIN_TEXT",
									"content": message
								}
							})
				};
				const response4 = await rp(options4);
				const json2 = JSON.parse(response4);
				const score = json2.documentSentiment.score;
				//const magnitude = json2.documentSentiment.magnitude;
				const score_int = score.toString();
				//const magnitude_int = magnitude.toString();
				console.log("感情分析:" + response4);
				console.log("score:" + json2.documentSentiment.score);
				//console.log("magnitude:" + json2.documentSentiment.magnitude);
			
				//-----------------------------------------------------------
			
				//COTOHA-API処理---------------------------------------------
				
				//const oauth_url = 'https://api.ce-cotoha.com/v1/oauth/accesstokens';
				//const model = 'ja-gen_tf-16';
				const client_id = 'ogml7QcKAgYCsGAAOkM7HulgGIkar5Xh';
				const client_secret = 'XjvCZUTUVM3nzoPV';
			
				//アクセストークン取得
				const options5 = {
					method: "POST",
					url:"https://api.ce-cotoha.com/v1/oauth/accesstokens",
					headers: {
							"charset":"UTF-8",
							"Content-Type":"application/json"
					},
					body: JSON.stringify({
							"grantType": "client_credentials",
							"clientId": client_id,
							"clientSecret": client_secret
					})
				};
			
				const response_access_token = await rp(options5);
				const json5 = JSON.parse(response_access_token);
				const access_token = json5.access_token;
				console.log("access_token:" + access_token);
				const Authoriz = "Bearer "+ access_token;
			
				//const message = "ＮＴＴの澤田純社長は１３日までにフジサンケイビジネスアイのインタビューに応じ、日米政府が政府調達機器からの排除方針を示している中国通信機器大手の華為技術（ファーウェイ）について、第５世代（５Ｇ）移動通信方式の基地局で採用しない方針を示した"
			
				//ユーザ属性推定処理------------------------------------------------
				const options6 = {
					method: "POST",
					url:"https://api.ce-cotoha.com/api/dev/nlp/beta/user_attribute",
					headers: {
						Authorization: Authoriz,
						charset: 'UTF-8',
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						"document":message
					})
				};
			
				const response6 = await rp(options6);
				const json6 = JSON.parse(response6);
			
				var age;
				age = json6.result.age;
			
				var gender
				gender = json6.result.gender;
			
				var hobby;
				hobby = json6.result.hobby.toString();
			
				var bussiness;
				bussiness = json6.result.kind_of_bussiness;
			
				var occupation;
				occupation = json6.result.kind_of_occupation;
			
				var occupation2;
				occupation2 = json6.result.occupation2;
			
				if (age === void 0){age = "不明"};
				if (gender === void 0){gender = "不明"};
				if (hobby === void 0){hobby = "不明"};
				if (bussiness === void 0){bussiness = "不明"};
				if (occupation === void 0){occupation = "不明"};
				if (occupation2 === void 0){occupation2 = "不明"};
				
				console.log("age:" + age);
				console.log("gender:" + gender);
				console.log("hobby:" + hobby);
				console.log("kind_of_bussiness:" + bussiness);
				console.log("kind_of_occupation:" + occupation);
				console.log("occupation:" + occupation2);
				
				//文タイプ判定
				const options7 = {
					method: "POST",
					url:"https://api.ce-cotoha.com/api/dev/nlp/v1/sentence_type",
					headers: {
						Authorization: Authoriz,
						charset: 'UTF-8',
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						"sentence":message
					})
				};
				
				const response7 = await rp(options7);
				//console.log("文タイプ判定:" + response4);
				const json7 = JSON.parse(response7);
			
				var modality;
				modality = json7.result.modality;
			
				var dialogact;
				dialogact = json7.result.dialog_act.toString();
			
				if (modality === void 0){modality = "不明"};
				if (dialogact === void 0){dialogact = "不明"};
			
				console.log("modality:" + modality);
				console.log("dialogact:" + dialogact);
			
				//---------------------------------------------------------
			
			
				//******************************************************* */
				// 電話番号の取得
				//******************************************************* */
				
				const phoneNumber = await readPhoneNumber();
			 
				//******************************************************* */
				// Chatworkへの送信
				//******************************************************* */
				//    json: true,
				/*
				const chatwork_token =  'dfec4e445f3f199bc3a313f21f50425a';
				const options2 = {
					url: 'https://api.chatwork.com/v2/rooms/131483658/messages',
					method: 'POST',
					headers : { 'X-ChatWorkToken': chatwork_token },
					form: {'body':'[info][title]' + phoneNumber + 'からメッセージを受け付けました[/title]' + message + '[/info]'}
				};
				const response2 = await rp(options2);
				console.log('CHATWORK:' + response2);
				*/
			
				//******************************************************* */
				// SFDCへの送信
				//******************************************************* */
				
				const options3 = {
					url: 'https://pkszk3l5y1.execute-api.ap-northeast-1.amazonaws.com/dev/',
					method: 'POST',
					headers : { 'Content-Type' : 'application/json; charset=UTF-8' },
					form: JSON.stringify({
					  "Details": {
						"Parameters": {
						  "sf_operation": "create",
						  "sf_object": "Case",
						  "Origin": "Phone",
						  "Status": "New",
						  "ContactId": "0030o00002VebPpAAJ",
						  "Subject": "アンケート",
						  "Priority": "Low",
						  "Description": phoneNumber + 'との通話録音内容：' + message,
						  "Usercomment__c": message,
						  "Emotionalvalue__c": score_int,
						  "age__c": age,
						  "gender__c": gender,
						  "hobby__c": hobby,
						  "kind_of_bussiness__c": bussiness,
						  "kind_of_occupation__c": occupation,
						  "occupation__c": occupation2,
						  "modality__c": modality,
						  "dialog_act__c": dialogact
						}
					  }
					})
				};
		});
	});
	
	//-----------------------------------------------------


    const response3 = await rp(options3);
    console.log('SFDC:' + response3);
    
    console.log('phoneNumber:' + phoneNumber);
    console.log('Message:' + message);
    return {"outputData": "put_S3"};

}

