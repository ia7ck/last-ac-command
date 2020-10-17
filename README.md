`/last-ac [username]`

![](https://user-images.githubusercontent.com/23146842/76809088-139b8e00-682d-11ea-86e0-0852d8207711.png)

## Deploy
以下のコマンドは動かないかも。GCP のダッシュボードから手動で index.js をアップロードしても OK
### Publisher
```sh
gcloud functions deploy lastAccepted --region=asia-east2 --runtime=nodejs10 --trigger-http --allow-unauthenticated --max-instances=1
```

### Topic
これは最初の一回のみでよい
```
gcloud pubsub topics create AtCoderProblems
```

### Subscripter
```
gcloud functions deploy sendSlack --region=asia-east2 --runtime=nodejs10 --trigger-topic=AtCoderProblems --max-instances=1
```
