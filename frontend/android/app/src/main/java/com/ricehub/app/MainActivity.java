package com.ricehub.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(AddressBookPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
