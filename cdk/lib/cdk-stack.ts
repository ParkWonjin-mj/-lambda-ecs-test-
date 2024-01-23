import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';
import { HttpLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import { DockerImageCode, DockerImageFunction } from 'aws-cdk-lib/aws-lambda';
import { HttpApi } from '@aws-cdk/aws-apigatewayv2-alpha';
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as servicediscovery from "aws-cdk-lib/aws-servicediscovery";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as log from "aws-cdk-lib/aws-logs";
import * as Iam from 'aws-cdk-lib/aws-iam';

import {
  ApplicationLoadBalancer,
  ApplicationProtocol,
  ApplicationTargetGroup,
  TargetType,
} from "aws-cdk-lib/aws-elasticloadbalancingv2";

import {
  BastionHostLinux,
  Peer,
  Port,
  SecurityGroup,
  SubnetType,
  Vpc,
} from "aws-cdk-lib/aws-ec2";

export class Frontend extends cdk.Stack {
  readonly endpoint: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    
    const PROJECT_NAME = "hinagiku";
    
    const SERVICE_NAME = "fsde-back_real"; // 벡엔드 ecs를 구분하기위해 
    
    const NAMESPACE = "local";
    
    // 참고로, 서비스의 검색이름은 <서비스이름>.<네임 스페이스>이다.
    //< vpc 정의 >  
    
    
    
    
    
    let vpc : ec2.Vpc;
    
    // vpc는 ec2의 구성요소 때문에, ec2.vpc로 정의한다. 
    vpc = new ec2.Vpc(this, 'vpc',{
      
      cidr : "10.0.0.0/16",
      vpcName : 'hinagiku-vpc',
      enableDnsHostnames : true,
      enableDnsSupport : true,
      subnetConfiguration : [
        {
          // 현재 퍼블릭 서브넷과 프라이빗 서브넷의 cidr 마스크를 24로 설정 
          
          // 퍼블릭과 프라이빗 서브넷의 주소가 따로 설정되어 있지 않으므로, 자동할당된다. 
          // 예를 들어, 퍼블릭 서브넷 10.0.1.0/24 , 프라이빗 서브넷 10.0.2.0/24 
          
          cidrMask : 24,
          name : "Publicsubnet",
          subnetType : ec2.SubnetType.PUBLIC,
        
        },
        {
          cidrMask : 24,
          name : "PrivateSubnet",
          subnetType : ec2.SubnetType.PRIVATE_ISOLATED,
          // subnetType : ec2.SubnetType.PUBLIC,
        }
        
        ],
        maxAzs : 2,
    })
    
    // < 클라우드 맵 정의 > 
    
      // 클라우드 맵의 서비스 디스커버리 기능을 사용하여 프라이빗 dns 네임 스페이스를 생성 
      
      // 클라우드 맵을 통해 애플리케이션의 서비스 인스턴스를 등록하고, 이를 이름으로 쉽게 검색 
      
      const dnsNamespace = new servicediscovery.PrivateDnsNamespace(
      this,
      // 위의 구문을 통해, 클라우드 맵 내에서 프라이빗 dns 네임 스페이스를 생성 
      
      // 노션에 제대로 정리한다. 
      
      // PrivateDnsNamespace는 vpc 내에서만 접근 가능한 도메인 이름을 제공 
      
      "ServiceDiscovery",
      {
        name: NAMESPACE,
        vpc,
      }
    );
    
    // < 프론트엔드와 백엔엔드 서비스에 대해서 보안 그룹 생성 > 
    
    const frontSG = new SecurityGroup(this, "FrontSecurityGroup", {
      vpc,
    });

    const backSG = new SecurityGroup(this, "BackSecurityGroup", {
      vpc,
    });
    
    // < 프론트로부터 오는 트래픽을 허용하는 인바운드 규칙을 백엔드 서비스에 설정 >
    
    
    backSG.addIngressRule(frontSG, Port.tcp(1235));
    // backSG라는 보안 그룹에 새로운 인바운드 규칙을 추가한다. 
    // 이 규칙은 frontSG 보안 그룹에 속한 모든 인스턴스 ( 여기서는 람다 함수 )
    // 가 TCP 프로토콜을 통해 1235 포트로 backSG에 속한 리소스 ( ecs 서비스 )
    // 에 접근할 수 있도록 한다. 
    
    
    ///// 프론트 엔드 /////
    
      // 람다 함수 iam 역할 정의 // 
    
      const iamRoleForLambda = new Iam.Role(this, "hinagiku-lambda-role", {
      roleName: `${PROJECT_NAME}-lambda-role`,
      assumedBy: new Iam.ServicePrincipal("lambda.amazonaws.com"),
      // VPCに設置するためのポリシー定義
      managedPolicies: [
        Iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaVPCAccessExecutionRole"
          // VPC 내부의 리소스와 통신하기 위한 ENI(Elastic Network Interface) 생성 및 관리.
          // VPC 내에서 필요한 네트워크 트래픽을 위한 로그 생성 및 관리.
        ),
      ],
    });
    
    // 클라우드 맵에 대한 람다 함수 IAM 역할 정의 // 
    
    const cloudMapPermissions = new Iam.PolicyStatement({
  actions: [
    "servicediscovery:RegisterInstance",
    "servicediscovery:DeregisterInstance",
    "servicediscovery:DiscoverInstances",
    "servicediscovery:GetInstance",
    "servicediscovery:GetInstancesHealthStatus",
    "servicediscovery:GetNamespace",
    "servicediscovery:GetService",
    "servicediscovery:ListInstances",
    "servicediscovery:ListNamespaces",
    "servicediscovery:ListServices"
  ],
  resources: ["*"], // You can restrict this to specific ARNs if necessary
});
    
    
    // ECS 서비스에 대한 추가 권한 정의
    const ecsPermissions = new Iam.PolicyStatement({
        actions: ["ecs:DescribeServices", "ecs:UpdateService"],
        resources: ["*"],  // 여기서는 모든 리소스에 대한 권한을 부여하고 있지만, 필요에 따라 특정 리소스에 대한 권한을 제한할 수 있습니다.
    });
    
    
    
    
    
    // < Lambda 정의 > 
    const handler = new DockerImageFunction(this, 'Handler', {
      code: DockerImageCode.fromImageAsset('./test_front', {
        // 람다 함수가 호출할 도커이미지 파일의 경로 
        platform: Platform.LINUX_AMD64,
      }),
      memorySize: 256,
      timeout: Duration.seconds(60),
      // 1/12일에 설정 
      vpc : vpc , // 람다를 vpc 안에 넣음 
      role : iamRoleForLambda, // 람다에 iam 역할 추가 
      vpcSubnets: {
      
      // subnetType: ec2.SubnetType.PRIVATE_ISOLATED, // 또는 필요에 따라 PUBLIC
    },
      securityGroups : [frontSG],
    });

    // < 람다 함수에 ecs 클러스터에 대한 IAM 역할할 부여 > 
    
    // iamRoleForLambda.addToPolicy(ecsPermissions);
    
    // 람다 함수에 대한 클라우드 맵에 대한 IAM 역할 부여 
    
    // iamRoleForLambda.addToPolicy(cloudMapPermissions);

    // < API Gateway 정의 > 
    new HttpApi(this, 'Api', {
      apiName: 'Frontend',
      defaultIntegration: new HttpLambdaIntegration('Integration', handler),
      corsPreflight: {
      
  },
      
      
    });
    
    ///// 백엔드 /////
    
    // 벡엔드 태스크 정의 // 
    // 태스크는 컨테이너의 실행 환경을 정의 // 
    
    
    const backendTask = new ecs.FargateTaskDefinition(this,"BackendTask",{
      
      runtimePlatform : {
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
        // 현재 빌드 환경이 x86이므로, 환경을 맞춰야 할 필요가 있다. 
        // 때문에, cpuArchitecture: ecs.CpuArchitecture.ARM64 코드를 
        // cpuArchitecture: ecs.CpuArchitecture.X86_64로 수정한다. 
        
      },
      
      memoryLimitMiB : 512,
      cpu : 256, // fargate vCPU의 할당 단위를 의미한다. 
    });
    
    
    
    // 백엔드 컨테이너를 정의 //
    
    // 백엔드 컨테이너 -> 태스크 ( ecs에서 움직이고 있는 컨테이너 )
    
    // 컨테이너는 애플리케이션 자체의 세부 사항 설정 // 
    
    const backendContainer = backendTask.addContainer("BackendContainer", {
      image: ecs.ContainerImage.fromAsset("./back/"),
      // 이미지는 컨테이너가 사용할 이미지를 지정한다. 
      // 즉, 위의 경로에 도커 파일 또는 다른 필요한 파일들이 포함되어 있어야 한다. 
      // 이 파일들을 사용하여, 도커 이미지가 생성된다. 
      
      // 컨테이너의 로그를 관리하는 방법을 결정 
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: "ecs-fsde-back",
        // 스트림 접두어-> 클라우드 워치 로그에 생성될 로그 스트림의 이름에 추가될 접두어 
        // 이를 통해 로그를 쉽게 식별하고 검색할 수 있다. 
        logRetention: log.RetentionDays.ONE_MONTH,
        // 로그 보존 기간 -> ( ONE_MONTH ) 한달로 설정 
      }),
      healthCheck: {
        command: ["CMD-SHELL", "curl -f http://localhost:1235 || exit 1"],
        // 컨테이너의 건강 상태를 검사하는 명령어 
        // 여기서 curl 명령어를 사용하여 컨테이너 내부의 1235포트에 http 요청을 보내고, 
        // 이 요청이 실패하면, exit 1을 출력한다. 
        retries: 2, // 명령이 실패할 경우, 재시도 횟수 
        interval: Duration.seconds(30), // 각 시도의 사이 간격 
        timeout: Duration.seconds(15), // 각 시도의 타임 아웃 
        startPeriod: Duration.seconds(5), // 컨테이너가 시작된 후, 헬스 체크가 시작되기까지의 시간 
        
        
      },
    });
    
    // 포트 추가 // 
    
    // 참고로, 내부 백엔드 서비스가 1235 포트를 사용하고 있으므로, 
    // 프론트엔드는 백엔드와 통신을 하기 위해, 1235 포트에 트래픽을 전송해야 한다. 
    
    
    backendContainer.addPortMappings({
      containerPort: 1235, // ecs 클러스터 안의 태스크 포트 번호 
      hostPort: 1235, // ecs 클러스터 포트 번호 
    });
    
    // 12월 26일 여기까지 정리 밑에 부터 다시 정리 -> 클러스터 
    
    // 백엔드 클러스터 정의 // 
    
    // 클러스터 내에서 여러 태스크와 서비스가 실행되며, 클러스터는 이들의 네트워크 구성과 
    
    // 할당을 관리한다. 
    
    // 클러스터는 특정 vpc에 할당된다. 이를 통해 클러스터 내의 모든 태스크는 해당 vpc의 
    // 네트ㅋ워크 설정 ( 서브넷, 라우팅, 보안 그룹 )을 사용한다. 
    // 즉, 프론트 엔드, 백엔드 , 데이터 베이스 등 )가 각각의 태스크로 클러스터 내에서 실행 
    
    /////////////////////////////////////////////////////////////////////
    
    // 1월 9일부터 여기서 다시 시작 /// 
    
    
    const backCluster = new ecs.Cluster(this, "BackCluster", {
      vpc,
    });

    new ecs.FargateService(this, "BackendService", {
      cluster: backCluster,
      taskDefinition: backendTask,
      desiredCount: 4, // 4개의 
      assignPublicIp: true, // true -> 프라이빗에 속하는 백엔드 ecs에 퍼블릭 공용 ip를 설정할 필요가 없으므로. 
      enableExecuteCommand: true,
      cloudMapOptions: {
        name: SERVICE_NAME,
        cloudMapNamespace: dnsNamespace,
        dnsRecordType: servicediscovery.DnsRecordType.A,
        dnsTtl: Duration.seconds(30),
      },
      securityGroups: [backSG], // 백엔드용 보안 그룹을 사용한다. 
    });
    
    
  }
  
  
  


  
  
}
