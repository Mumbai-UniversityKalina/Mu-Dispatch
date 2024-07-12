import streamlit as st
import pandas as pd
import requests
from datetime import datetime
import time

# Configure the page to make use of the full screen width
st.set_page_config(layout="wide")

# URL configuration for PocketBase
BASE_URL = "https://mucollegdb.pockethost.io"
ENDPOINT_GET_DISPATCH = "/api/collections/dispatch/records"
ENDPOINT_POST_DISPATCH = "/api/collections/dispatch/records"
ENDPOINT_GET_COLLEGES = "/api/collections/colleges/records"
ENDPOINT_GET_COURSES = "/api/collections/courses/records"
ENDPOINT_GET_CATEGORIES = "/api/collections/categories/records"
HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_ACCESS_TOKEN',  # Ensure you replace this with your actual API token
}

def load_data(file):
    if file.name.endswith('.csv'):
        df = pd.read_csv(file)
    elif file.name.endswith('.xlsx'):
        df = pd.read_excel(file)
    return df[['COLL_NO', 'COLL_NAME', 'EXAM']].drop_duplicates()

def get_college_id_by_coll_no(coll_no):
    """ Fetch the college_id based on COLL_NO from the colleges collection. """
    relation_api_url = f'{BASE_URL}{ENDPOINT_GET_COLLEGES}?filter=(college_id="{coll_no}")'
    response = requests.get(relation_api_url, headers=HEADERS)
    if response.status_code == 200:
        results = response.json().get('items', [])
        if results:
            return results[0]['id']  # Return the id of the matching college
    st.error(f"No matching college found for COLL_NO: {coll_no}")
    return None

def add_data_to_db(data):
    headers = {"Content-Type": "application/json"}
    for _, row in data.iterrows():
        college_id = get_college_id_by_coll_no(row['COLL_NO'])
        if not college_id:
            st.error(f"No matching college found for COLL_NO: {row['COLL_NO']}")
            continue
        
        payload = {
            "college": college_id,  # This is the relation field
            "exam_date": row['EXAM'].strftime('%Y-%m-%d') if isinstance(row['EXAM'], datetime) else row['EXAM'],
            "status": "Pending",
            "remark": "No Remarks"
        }
        response = requests.post(BASE_URL + ENDPOINT_POST_DISPATCH, json=payload, headers=headers)
        if response.status_code != 200:
            st.error(f"Failed to add data: {response.text}")
        else:
            st.success("Data added successfully!")

def fetch_data_from_db(date_filter=None):
    response = requests.get(BASE_URL + ENDPOINT_GET_DISPATCH)
    if response.status_code == 200:
        data = response.json()['items']
        df = pd.DataFrame(data)
        if not df.empty:
            df = df[['college', 'status', 'remark', 'created', 'exam_date']]
            if date_filter:
                df['created'] = pd.to_datetime(df['created']).dt.date
                df = df[df['created'] == date_filter]
        return df
    return pd.DataFrame()

def main():
    st.title('College Data Upload and Display App')

    col1, col2 = st.columns([1, 3])
    with col1:
        file = st.file_uploader("Upload a CSV or Excel file", type=['csv', 'xlsx'])
        if file:
            df_uploaded = load_data(file)
            if st.button('Upload Data to Database'):
                add_data_to_db(df_uploaded)

        selected_date = st.date_input("Select a Date", datetime.today())

    with col2:
        st.subheader('Current Data in Database')
        df_db = fetch_data_from_db(selected_date)
        st.dataframe(df_db)

if __name__ == "__main__":
    main()
