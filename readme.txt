★awsコマンド

・ profile は、個人別に変わります。

// バケット作り
aws s3 mb s3://aicc-1761519-2-s3wav-bkt

// ここで、index.zipを作成する。＠Linux環境
   chmod +x ffmpeg
   chnod +x index.js //一応やっとく
   zip -rq index.zip index.js ffmpeg package-lock.json node_modules/

// awsへアップロード。template.yamlからpackaged-template.yamlに変換される。
aws cloudformation package --template-file template.yaml --s3-bucket aicc-1761519-2-s3wav-bkt --output-template-file packaged-template.yaml

// デプロイ
aws cloudformation deploy --template-file packaged-template.yaml --stack-name aicc-1761519-2-s3wav-stk --capabilities CAPABILITY_IAM

// ↓は1回だけやればよさそう。例のlambdaにamazon connectへの権限をつけるやつ。
// Amazon Connect の設定：問い合わせフローの「AWS Lambda」に呼び出すLambdaを追加すれば不要
aws lambda add-permission --region ap-southeast-2 --function-name function:aicc-1761519-s3wav-stk-AICC1761519s3wavFunc-1P2TGJI2IR87B --statement-id 1 --principal connect.amazonaws.com  --action lambda:InvokeFunction --source-account 326447680198 --source-arn arn:aws:connect:ap-southeast-2:326447680198:instance/46a33011-e707-43bf-94fd-69219645c220

