import React from 'react';
import ReactDOM from 'react-dom/client';
import { App as AntApp, ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import { HashRouter } from 'react-router-dom';
import { StoreProvider } from './app/store';
import { Application } from './app/Application';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={viVN} theme={{ token: { colorPrimary: '#1467b4', borderRadius: 9, fontFamily: 'Inter, "Segoe UI", Arial, sans-serif', colorBgLayout: '#f4f7fb', colorText: '#203653' }, components: { Button: { controlHeight: 38 }, Table: { headerBg: '#f7f9fc', cellPaddingBlock: 17 } } }}>
      <AntApp><HashRouter><StoreProvider><Application /></StoreProvider></HashRouter></AntApp>
    </ConfigProvider>
  </React.StrictMode>,
);
