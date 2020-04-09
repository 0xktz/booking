import 'reflect-metadata';
import { ApolloServer } from 'apollo-server-express';
import { buildSchema } from 'type-graphql';
import Express from 'express';
import { createConnection } from 'typeorm';
import { User } from './entity/User';
import RegisterResolver from './modules/auth/register/tranditional/register.resolver';
import { authUserMiddleware } from './modules/auth/auth-user-middleware';
import { RequestPasswordResetResolver } from './modules/auth/forgot-password/reset-request/request-password-reset.resolver';
import { PasswordResetResolver } from './modules/auth/forgot-password/reset/password-reset.resolver';
import { GoogleLoginResolver } from './modules/auth/login/google/google-login.resolver';
require('dotenv').config();

const jwt = require('jsonwebtoken');

const app = Express();
let schema: any;

const connectToDb = async () => {
  try {
    await createConnection();
    console.log('Connected to database');
  } catch (e) {
    console.log('Connection to db failed \n', e);
  }
};

const stitchSchema = async () => {
  try {
    schema = await buildSchema({
      resolvers: [RegisterResolver, RequestPasswordResetResolver, PasswordResetResolver, GoogleLoginResolver],
      authChecker: authUserMiddleware
    });
  } catch (e) {
    console.log('Failed to create schema', e);
  }
};

const initServer = async () => {
  await connectToDb();
  await stitchSchema();

  const apolloServer = new ApolloServer({
    context: async ({ req }) => {
      let token = req.headers.authorization;
      if (token && token !== '') {
        token = token.split('Bearer ')[1];
        const tokenInfo = jwt.verify(token, process.env.JWT_SECRET);
        if (tokenInfo) {
          console.log('token exists');
          if (Math.floor(Date.now() / 1000) < tokenInfo.exp) {
            await User.findOne({ id: tokenInfo.id })
              .then(user => {
                return { userId: tokenInfo.id, role: user!.role };
              })
              .catch(e => {
                console.log(e);
                return {};
              });
          }
        }
        return {};
      } else {
        return {};
      }
    },
    schema
  });

  apolloServer.applyMiddleware({
    app,
    cors: {
      credentials: true,
      origin: true
    },
    path: '/'
  });

  app.listen(process.env.PORT, () => {
    console.log('Server running on port', process.env.PORT);
  });
};

initServer();
