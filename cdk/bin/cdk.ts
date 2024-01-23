#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Frontend } from '../lib/cdk-stack';

const app = new cdk.App();
new Frontend(app, 'FrontendStackForCloudMap', {
  // 기존의 스택과 별도로 생성하기 위해, 스택의 이름을 변경 
  // 이렇게 되면, 기존의 스택에서 변경이 이루어지는 것이 아닌, 
  // 새로운 스택이 생성된다. 
  
  // 필요한 구성 추가
  // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  // env: { account: '123456789012', region: 'us-east-1' },
});