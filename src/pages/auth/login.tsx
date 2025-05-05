import React from 'react';
import Layout from '../../components/Layout/Layout';
import AuthForm from '../../components/Auth/AuthForm';

const LoginPage: React.FC = () => {
  return (
    <Layout>
      <AuthForm />
    </Layout>
  );
};

export default LoginPage;