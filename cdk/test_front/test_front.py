import requests
import json 
import boto3

def test(event,context):
    # event에는 http 요청의 모든 정보를 담고 있다. 
    
    url = "http://fsde-back_real.local:1235" # ecs 백엔드 클러스터 url 
    # url = "https://google.co.jp"
    
    # url = "http://fsde-back_real.local:1235"가 되어있으면, 
    # 80번 포트로, 요청을 한다. 
    
    res = requests.get(url)
    
    print(res)
    
    return{
        "statusCode" : 200,
        "body" : json.dumps(f"hello ! processing is complitied !")
        
    # request라이브러리에서 http 응답의 본문은 res.text 속성에 저장 
    
    
    }

# # Cloud Map 클라이언트 초기화
# client = boto3.client('servicediscovery')

# # 특정 서비스의 인스턴스 검색
# response = client.discover_instances(
#     NamespaceName='local',
#     ServiceName='fsde-back_real'
# )

# # 검색된 인스턴스의 IP 주소 및 포트 정보 가져오기
# instances = response['Instances']
# for instance in instances:
#     ip = instance['Attributes']['AWS_INSTANCE_IPV4']
#     port = instance['Attributes']['AWS_INSTANCE_PORT']
#     # 이 정보를 사용하여 백엔드 서비스에 연결
