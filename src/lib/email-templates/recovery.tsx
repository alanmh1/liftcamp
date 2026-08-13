import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Img,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset your password for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://liftcamp.app/liftcamp-wordmark.png"
          width="150"
          alt="LiftCamp"
          style={logo}
        />
        <Heading style={h1}>Reset your password</Heading>
        <Text style={text}>
          We received a request to reset your password for {siteName}. Click
          the button below to choose a new password.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Reset Password
        </Button>
        <Text style={footer}>
          If you didn't request a password reset, you can safely ignore this
          email. Your password will not be changed.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: '"Hanken Grotesk", Helvetica, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const logo = { display: 'block', margin: '0 0 24px', height: 'auto' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#12283F',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#4A5A6A',
  lineHeight: '1.5',
  margin: '0 0 25px',
}
const button = {
  backgroundColor: '#1B5FA8',
  color: '#ffffff',
  fontSize: '14px',
  borderRadius: '10px',
  padding: '14px 26px', fontWeight: 'bold' as const,
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#8A94A0', margin: '30px 0 0' }
