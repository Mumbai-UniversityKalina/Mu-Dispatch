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

def fetch_dispatch_data(date_filter=None):
    response = requests.get(BASE_URL + ENDPOINT_GET_DISPATCH, headers=HEADERS)
    if response.status_code == 200:
        data = response.json()['items']
        df = pd.DataFrame(data)
        if not df.empty:
            df = df[['college', 'exam_date']]
            if date_filter:
                df['exam_date'] = pd.to_datetime(df['exam_date']).dt.date
                df = df[df['exam_date'] == date_filter]
            return df
    return pd.DataFrame()

def main():
    st.title('College Dispatch Data Viewer')

    selected_date = st.date_input("Select a Date", datetime.today())

    df_dispatch = fetch_dispatch_data(selected_date)

    if not df_dispatch.empty:
        college_data = []
        for college_id in df_dispatch['college'].unique():
            college_info = fetch_college_data(college_id)
            if college_info:
                college_data.append({
                    'college_id': college_info['id'],
                    'college_name': college_info['college_name'],
                    'route_code': college_info.get('route_code', 'N/A'),
                    'route_name': college_info.get('route_name', 'N/A')
                })

        df_colleges = pd.DataFrame(college_data)
        merged_df = df_dispatch.merge(df_colleges, left_on='college', right_on='college_id', how='left')
        st.dataframe(merged_df[['college_id', 'college_name', 'route_code', 'route_name', 'exam_date']])
    else:
        st.warning("No data found for the selected date.")

if __name__ == "__main__":
    main()
