/**
 * @fileoverview Authorization HOC
 */
import * as React from 'react';
import Router from 'next/router';
import nextCookie from 'next-cookies';
import { NextComponentType } from 'next';

import AuthContext, { Auth } from '../components/AuthContext';
import * as authAPI from '../api/auth';

export interface Options {
  permissions?: string[];
}

interface State {
  isAuthorized: boolean;
}

interface WithAuthProps {
  auth: Auth;
}

// Gets the display name of a JSX component for dev tools
const getDisplayName = (Component: any) =>
  Component.displayName || Component.name || 'Component';

const withPermission = ({ permissions = [] }: Options) => <P extends {}>(
  WrappedComponent: NextComponentType<P, any, any>
) =>
  class extends React.Component<P & WithAuthProps, State> {
    static displayName = `withPermission(${getDisplayName(WrappedComponent)})`;

    static async getInitialProps(ctx: any) {
      const { token } = nextCookie(ctx);
      const auth = token && (await authAPI.load(token));

      // サーバサイドで認証情報の取得に失敗したらログインページへ遷移させる
      if (ctx.req && !auth) {
        ctx.res.writeHead(302, { Location: '/login' });
        ctx.res.end();
        return null;
      }
      // クライアントサイドで認証情報の取得に失敗したらログインページへ遷移させる
      if (!auth) {
        Router.push('/login');
      } else {
        let isAuthorized = false;
        // 権限リストが設定されていなければ無条件で認可する
        if (!permissions.length) {
          isAuthorized = true;
        } else {
          // 権限リストとログイン情報の権限が一致したら認可する
          permissions.forEach(permission => {
            auth.permissions.forEach(authPermission => {
              if (authPermission === permission) {
                isAuthorized = true;
              }
            });
          });
        }

        // サーバサイドで権限不足ならば、/noAuthへ遷移させる
        if (ctx.req && !isAuthorized) {
          ctx.res.writeHead(302, { Location: '/noAuth' });
          ctx.res.end();
          return null;
        }
        // クライアントサイドで権限不足ならば、/noAuthへ遷移させる
        if (!isAuthorized) {
          Router.push('/noAuth');
          return null;
        }
      }

      // ラップされるコンポーネントのgetInitialPropsを実行する
      const componentProps =
        WrappedComponent.getInitialProps &&
        (await WrappedComponent.getInitialProps(ctx));

      return { ...componentProps, auth };
    }

    render() {
      const { auth, ...props } = this.props;
      return (
        <AuthContext.Provider value={{ ...auth }}>
          <WrappedComponent {...props as P} />
        </AuthContext.Provider>
      );
    }
  };

export default withPermission;
