import streamlit as st
import pandas as pd
import requests
from datetime import datetime

# Configure the page to make use of the full screen width
st.set_page_config(layout="wide")

# URL configuration for PocketBase
BASE_URL = "https://mucollegdb.pockethost.io"
ENDPOINT_GET_DISPATCH = "/api/collections/dispatch/records"
ENDPOINT_GET_COLLEGES = "/api/collections/colleges/records"
HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_ACCESS_TOKEN',  # Ensure you replace this with your actual API token
}

def fetch_college_data(college_id):
    response = requests.get(f"{BASE_URL}{ENDPOINT_GET_COLLEGES}/{college_id}", headers=HEADERS)
    if response.status_code == 200:
        return response.json()
    else:
        return None

def fetch_dispatch_data():
    response = requests.get(BASE_URL + ENDPOINT_GET_DISPATCH, headers=HEADERS)
    if response.status_code == 200:
        data = response.json()['items']
        df = pd.DataFrame(data)
        if not df.empty:
            df['exam_date'] = pd.to_datetime(df['exam_date']).dt.date
            return df
    return pd.DataFrame()

def main():
    st.title('College Dispatch Data Viewer')

    # Custom CSS to adjust the width and height of the table and filter layout
    st.markdown("""
        <style>
        .stDataFrame div {
            max-width: 100%;
            max-height: 500px;
        }
        .stDataFrame table {
            width: 100%;
        }
        .stSidebar .block-container {
            padding-top: 0;
        }
        </style>
    """, unsafe_allow_html=True)

    # Fetch dispatch data without any date filter by default
    df_dispatch = fetch_dispatch_data()

    if not df_dispatch.empty:
        college_data = []
        for college_id in df_dispatch['college'].unique():
            college_info = fetch_college_data(college_id)
            if college_info:
                college_data.append({
                    'college_id': college_info['id'],
                    'college_code': college_info['college_id'],
                    'college_name': college_info['college_name'],
                    'route_code': college_info.get('route_code', 'N/A'),
                    'route_name': college_info.get('route_name', 'N/A')
                })

        df_colleges = pd.DataFrame(college_data)
        merged_df = df_dispatch.merge(df_colleges, left_on='college', right_on='college_id', how='left')

        # Creating filters in a single row
        col1, col2, col3 = st.columns(3)
        with col1:
            selected_date = st.date_input("Select a Date (optional)", value=None)
        with col2:
            route_code_filter = st.selectbox('Select Route Code', ['All'] + merged_df['route_code'].unique().tolist(), index=0)
        with col3:
            if route_code_filter != 'All':
                filtered_df = merged_df[merged_df['route_code'] == route_code_filter]
            else:
                filtered_df = merged_df
            college_code_filter = st.selectbox('Select College Code', ['All'] + filtered_df['college_code'].unique().tolist(), index=0)

        if selected_date:
            filtered_df = filtered_df[filtered_df['exam_date'] == selected_date]
        if route_code_filter != 'All':
            filtered_df = filtered_df[filtered_df['route_code'] == route_code_filter]
        if college_code_filter != 'All':
            filtered_df = filtered_df[filtered_df['college_code'] == college_code_filter]

        st.dataframe(filtered_df[['college_code', 'college_name', 'route_code', 'route_name', 'exam_date']])
    else:
        st.warning("No data found.")

if __name__ == "__main__":
    main()
