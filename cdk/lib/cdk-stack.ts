import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const STACK_NAME = id;

    const env = this.node.tryGetContext('env')

    let hostedZoneId = ssm.StringParameter.valueForStringParameter(this, '/config/edgeUi/hostedZoneId');
    let hostedZoneName = ssm.StringParameter.valueForStringParameter(this, '/config/edgeUi/hostedZoneName');

    console.log("hostedZoneId: " + hostedZoneId)

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'edgeUiAppHostedZone', {
      hostedZoneId: hostedZoneId,
      zoneName: hostedZoneName,
    });

    const fn = new lambda.Function(this, STACK_NAME + '-subscription-handler-function', {
      runtime: lambda.Runtime.NODEJS_14_X,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'SubscriptionHandler.handler',
    });

    let wildcardCertArn = ssm.StringParameter.valueForStringParameter(this, '/config/edgeUi/wildcardCertArn');

    let restApi = new apigw.LambdaRestApi(this, STACK_NAME + '-apigateway', {
      handler: fn,
      domainName: {
        domainName: 'api-' + env + '.edgeui.app',
        securityPolicy: apigw.SecurityPolicy.TLS_1_2,
        certificate: acm.Certificate.fromCertificateArn(this, 'cert', wildcardCertArn),
      }
    })

    new route53.ARecord(this, "apiDNS", {
      zone: hostedZone,
      recordName: 'api-' + env,
      target: route53.RecordTarget.fromAlias(
        new route53Targets.ApiGateway(restApi)
      ),
    });
  }
}
