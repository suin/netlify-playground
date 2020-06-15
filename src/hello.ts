import {
  APIGatewayProxyEvent,
  APIGatewayProxyCallback
} from 'aws-lambda'

export const handler = (
  event: APIGatewayProxyEvent,
  context: any,
  callback: APIGatewayProxyCallback
) => {
  const subject = event.queryStringParameters.name || 'World'
  callback(null, {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(`Hello ${subject}`)
  })
}
