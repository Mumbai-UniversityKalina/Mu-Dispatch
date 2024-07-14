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
ENDPOINT_UPDATE_DISPATCH = "/api/collections/dispatch/records"
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

def update_dispatch_status(record_id, name):
    update_data = {
        "status": "complete",
        "name": name
    }
    response = requests.patch(f"{BASE_URL}{ENDPOINT_UPDATE_DISPATCH}/{record_id}", headers=HEADERS, json=update_data)
    if response.status_code == 200:
        return True
    else:
        return False

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
        .stButton button {
            width: auto;
            display: inline-block;
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
        col1, col2 = st.columns(2)
        with col1:
            selected_date = st.date_input("Select a Date", value=None)
        with col2:
            route_code_filter = st.selectbox('Select Route Code', merged_df['route_code'].unique().tolist(), index=0)

        if selected_date and route_code_filter:
            filtered_df = merged_df[(merged_df['exam_date'] == selected_date) & (merged_df['route_code'] == route_code_filter)]
            if not filtered_df.empty:
                # Initialize the selected items if not already done
                if 'selected_items' not in st.session_state:
                    st.session_state['selected_items'] = {}

                # Display the table headers
                headers = ["College Code", "College Name", "Route Code", "Route Name", "Exam Date", "Completed", "Picked Up By"]
                columns = st.columns([1, 2, 1, 2, 2, 1, 2])
                for col, header in zip(columns, headers):
                    col.write(f"**{header}**")

                # Display the table rows
                for index, row in filtered_df.iterrows():
                    columns = st.columns([1, 2, 1, 2, 2, 1, 2])
                    columns[0].write(row['college_code'])
                    columns[1].write(row['college_name'])
                    columns[2].write(row['route_code'])
                    columns[3].write(row['route_name'])
                    columns[4].write(row['exam_date'])

                    completed = columns[5].checkbox("", key=f"checkbox_{row['college_id']}_{index}")

                    if completed and row['college_id'] not in st.session_state['selected_items']:
                        st.session_state['selected_items'][row['college_id']] = {
                            'college_name': row['college_name'],
                            'record_id': row['id'],
                            'name': ''
                        }

                    # Display name input if checkbox is checked and name is not set
                    if row['college_id'] in st.session_state['selected_items']:
                        if st.session_state['selected_items'][row['college_id']]['name'] == '':
                            with columns[6]:
                                person_name = st.text_input("Name", key=f"person_name_{row['college_id']}")
                                submit_button = st.button(f"Submit", key=f"submit_{row['college_id']}")
                                if submit_button and person_name:
                                    if update_dispatch_status(st.session_state['selected_items'][row['college_id']]['record_id'], person_name):
                                        st.session_state['selected_items'][row['college_id']]['name'] = person_name
                                        st.experimental_rerun()
                                    else:
                                        st.error(f"Failed to update status for {row['college_name']}")
                        else:
                            name = st.session_state['selected_items'][row['college_id']]['name']
                            columns[6].write(name)
                    else:
                        columns[6].write(st.session_state['selected_items'][row['college_id']]['name'] if row['college_id'] in st.session_state['selected_items'] else '')

            else:
                st.warning("No data found for the selected date and route.")
        else:
            st.warning("Please select both a date and a route code to view data.")
    else:
        st.warning("No data found.")

if __name__ == "__main__":
    main()
