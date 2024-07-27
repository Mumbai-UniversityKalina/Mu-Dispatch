"use client"

import { useState } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Header from '@/components/header';
import Footer from '@/components/footer';
import * as XLSX from 'xlsx';
import PocketBase from 'pocketbase';

const BASE_URL = "https://mucollegdb.pockethost.io";
const ENDPOINT_POST_DISPATCH = "/api/collections/dispatch/records";
const ENDPOINT_GET_COLLEGES = "/api/collections/colleges/records";
const HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_ACCESS_TOKEN', // Ensure you replace this with your actual API token
};

const pb = new PocketBase(BASE_URL);

export default function Upload() {
  const [file, setFile] = useState(null);

  const loadFileData = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        let data;
        if (file.name.endsWith('.csv')) {
          data = e.target.result.split('\n').map(row => row.split(','));
          const headers = data[0];
          if (headers.includes('COLL_NO') && headers.includes('COLL_NAME') && headers.includes('EXAM')) {
            const df = data.slice(1).map(row => ({
              COLL_NO: row[headers.indexOf('COLL_NO')],
              COLL_NAME: row[headers.indexOf('COLL_NAME')],
              EXAM: row[headers.indexOf('EXAM')]
            }));
            resolve(df);
          } else {
            reject(new Error('Required headers (COLL_NO, COLL_NAME, EXAM) not found'));
          }
        } else if (file.name.endsWith('.xlsx')) {
          const workbook = XLSX.read(e.target.result, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
          const headers = worksheet[0];
          if (headers.includes('COLL_NO') && headers.includes('COLL_NAME') && headers.includes('EXAM')) {
            const df = worksheet.slice(1).map(row => ({
              COLL_NO: row[headers.indexOf('COLL_NO')],
              COLL_NAME: row[headers.indexOf('COLL_NAME')],
              EXAM: row[headers.indexOf('EXAM')]
            }));
            resolve(df);
          } else {
            reject(new Error('Required headers (COLL_NO, COLL_NAME, EXAM) not found'));
          }
        }
      };
      reader.onerror = (error) => reject(error);
      if (file.name.endsWith('.csv')) {
        reader.readAsText(file);
      } else if (file.name.endsWith('.xlsx')) {
        reader.readAsBinaryString(file);
      }
    });
  };

  const getCollegeIdByCollNo = async (collNo) => {
    const relationApiUrl = `${BASE_URL}${ENDPOINT_GET_COLLEGES}?filter=(college_id="${collNo}")`;
    const response = await axios.get(relationApiUrl, { headers: HEADERS });
    if (response.status === 200) {
      const results = response.data.items;
      if (results.length > 0) {
        return results[0].id;
      }
    }
    toast.error(`No matching college found for COLL_NO: ${collNo}`);
    return null;
  };

  const addDataToDb = async (data) => {
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const collegeId = await getCollegeIdByCollNo(row.COLL_NO);
      if (!collegeId) {
        toast.error(`No matching college found for COLL_NO: ${row.COLL_NO}`);
        continue;
      }

      // Convert EXAM date to ISO 8601 format
      let examDate;
      try {
        const [month, day, year] = row.EXAM.toString().split('/');
        examDate = new Date(row.EXAM).toISOString();
      } catch (error) {
        toast.error(`Invalid date format for COLL_NO: ${row.COLL_NO}`);
        continue;
      }

      const payload = {
        college: collegeId,
        exam_date: examDate,
        status: "Pending",
        remark: "No Remarks"
      };

      try {
        const record = await pb.collection('dispatch').create(payload);
        if (record) {
          toast.success(`Data added successfully for COLL_NO: ${row.COLL_NO}`);
        } else {
          toast.error(`Failed to add data for COLL_NO: ${row.COLL_NO}`);
        }
      } catch (error) {
        toast.error(`Failed to add data: ${error.message}`);
      }

      if ((i + 1) % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Delay for 2 seconds after every 10 records
      }
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    setFile(file);
    try {
      const data = await loadFileData(file);
      if (data && confirm('Are you sure you want to upload this data?')) {
        await addDataToDb(data);
      }
    } catch (error) {
      toast.error(`Failed to load file data: ${error.message}`);
    }
  };

  const handleSubmit = async () => {
    if (file) {
      try {
        const data = await loadFileData(file);
        await addDataToDb(data);
      } catch (error) {
        toast.error(`Failed to load file data: ${error.message}`);
      }
    } else {
      toast.error('Please upload a file first');
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto flex flex-col items-center p-4">
        <ToastContainer />
        <div className="flex flex-col space-y-4 items-center mb-4">
          <input type="file" accept=".csv, .xlsx" onChange={handleFileUpload} className="border p-2 rounded" />
          <button onClick={handleSubmit} className="bg-blue-500 text-white p-2 rounded">Submit</button>
        </div>
      </main>
      <Footer />
    </div>
  );
}
